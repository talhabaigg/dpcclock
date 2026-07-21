<?php

namespace App\Http\Controllers;

use App\Jobs\ImportAconexDrawingJob;
use App\Models\Drawing;
use App\Models\Location;
use App\Services\AconexClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class AconexImportController extends Controller
{
    /**
     * The "Import from Aconex" page: shows the link-to-Aconex-project step
     * if not yet configured, otherwise the search/select/import picker.
     */
    public function show(Location $project): Response
    {
        // Only drawings that came from Aconex — manual uploads would be
        // confusing on this screen.
        $recentDrawings = Drawing::where('project_id', $project->id)
            ->whereNotNull('aconex_document_id')
            ->whereIn('status', [Drawing::STATUS_DRAFT, Drawing::STATUS_PROCESSING, Drawing::STATUS_PENDING_REVIEW, Drawing::STATUS_ACTIVE])
            ->with('media')
            ->select(['id', 'project_id', 'sheet_number', 'title', 'revision_number', 'status', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return Inertia::render('projects/drawings/aconex-import', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'aconex_project_id' => $project->aconex_project_id,
            ],
            'recentDrawings' => $recentDrawings,
        ]);
    }

    /**
     * List Aconex projects the configured OAuth client can see, so the user
     * can pick one from a dropdown instead of typing a raw project ID.
     */
    public function listAconexProjects(AconexClient $aconex)
    {
        try {
            $projects = collect($aconex->listProjects())->map(fn ($p) => [
                'id' => (string) $p['projectID'],
                'name' => $p['projectName'] ?? $p['projectShortName'] ?? (string) $p['projectID'],
            ])->values();

            return response()->json(['projects' => $projects]);
        } catch (\Throwable $e) {
            Log::error('AconexImportController: failed to list Aconex projects', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Could not reach Aconex: '.$e->getMessage()], 502);
        }
    }

    /**
     * Link this Location to an Aconex project (one-time setup per project).
     */
    public function link(Request $request, Location $project)
    {
        $validated = $request->validate([
            'aconex_project_id' => 'required|string|max:100',
        ]);

        $project->update(['aconex_project_id' => $validated['aconex_project_id']]);

        return response()->json(['success' => true]);
    }

    /**
     * Search the linked Aconex project's document register.
     * Flags documents that already have a matching Drawing (by document number)
     * in this project, and whether the Aconex revision is newer.
     */
    public function search(Request $request, Location $project)
    {
        if (! $project->aconex_project_id) {
            return response()->json(['message' => 'This project is not linked to an Aconex project yet.'], 422);
        }

        $validated = $request->validate([
            'query' => 'sometimes|string|max:500',
        ]);

        $query = $validated['query'] ?? 'doctype:"Drawing"';

        try {
            $aconexClient = app(AconexClient::class);
            $documents = $aconexClient->searchDocuments($project->aconex_project_id, $query);
        } catch (\Throwable $e) {
            Log::error('AconexImportController: search failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Aconex search failed: '.$e->getMessage()], 502);
        }

        $existingBySheet = Drawing::where('project_id', $project->id)
            ->whereNotNull('sheet_number')
            ->orderBy('created_at', 'desc')
            ->get(['sheet_number', 'revision_number'])
            ->groupBy('sheet_number')
            ->map(fn ($group) => $group->first()->revision_number);

        $documents = collect($documents)->map(function ($doc) use ($existingBySheet) {
            $existingRevision = $existingBySheet->get($doc['document_number']);
            $doc['already_imported'] = $existingRevision !== null;
            $doc['import_is_new_revision'] = $existingRevision !== null && $existingRevision !== $doc['revision'];

            return $doc;
        })->values();

        return response()->json(['documents' => $documents]);
    }

    /**
     * All versions of one Aconex document (by document number) that are
     * visible to our org, newest first, flagged with local import state.
     */
    public function versions(Request $request, Location $project, AconexClient $aconex)
    {
        if (! $project->aconex_project_id) {
            return response()->json(['message' => 'This project is not linked to an Aconex project yet.'], 422);
        }

        $validated = $request->validate([
            'document_number' => 'required|string|max:200',
        ]);

        try {
            $documents = $aconex->searchDocuments(
                $project->aconex_project_id,
                'docno:"'.str_replace('"', '', $validated['document_number']).'"',
                100,
                includeHistory: true,
            );
        } catch (\Throwable $e) {
            Log::error('AconexImportController: versions lookup failed', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Aconex version lookup failed: '.$e->getMessage()], 502);
        }

        $importedIds = Drawing::where('project_id', $project->id)
            ->whereNotNull('aconex_document_id')
            ->pluck('aconex_document_id')
            ->flip();

        $versions = collect($documents)
            ->filter(fn ($doc) => $doc['document_number'] === $validated['document_number'])
            ->map(function ($doc) use ($importedIds) {
                $doc['already_imported'] = $importedIds->has($doc['aconex_document_id']);

                return $doc;
            })
            ->sortByDesc('version_number')
            ->values();

        return response()->json(['versions' => $versions]);
    }

    /**
     * Stream a document's file inline so the browser can preview it (PDFs
     * render natively in a new tab) before deciding to import.
     */
    public function preview(Location $project, string $documentId, AconexClient $aconex)
    {
        if (! $project->aconex_project_id) {
            abort(404, 'This project is not linked to an Aconex project yet.');
        }

        try {
            $file = $aconex->downloadDocument($project->aconex_project_id, $documentId);
        } catch (\Throwable $e) {
            Log::error('AconexImportController: preview failed', ['document_id' => $documentId, 'error' => $e->getMessage()]);

            abort(502, 'Could not fetch the document from Aconex.');
        }

        // Aconex reports application/octet-stream for everything, which makes
        // browsers download instead of rendering — infer from the extension.
        $mime = $file['mime'];
        if (! $mime || $mime === 'application/octet-stream') {
            $mime = match (strtolower(pathinfo($file['filename'], PATHINFO_EXTENSION))) {
                'pdf' => 'application/pdf',
                'png' => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                default => 'application/octet-stream',
            };
        }

        return response($file['contents'], 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="'.str_replace('"', '', $file['filename']).'"',
        ]);
    }

    /**
     * Queue an import job for each selected document. Returns immediately —
     * imports happen in the background (same pattern as ProcessDrawingJob),
     * so selecting hundreds of documents doesn't time out the request.
     */
    public function import(Request $request, Location $project)
    {
        if (! $project->aconex_project_id) {
            return response()->json(['message' => 'This project is not linked to an Aconex project yet.'], 422);
        }

        $validated = $request->validate([
            'documents' => 'required|array|min:1|max:500',
            'documents.*.aconex_document_id' => 'required|string',
            'documents.*.document_number' => 'sometimes|nullable|string',
            'documents.*.title' => 'sometimes|nullable|string',
            'documents.*.revision' => 'sometimes|nullable|string',
            'documents.*.version_number' => 'sometimes|nullable|integer',
            'documents.*.date_modified' => 'sometimes|nullable|string',
        ]);

        foreach ($validated['documents'] as $doc) {
            ImportAconexDrawingJob::dispatch(
                $project->id,
                $doc['aconex_document_id'],
                $doc['document_number'] ?? '',
                $doc['title'] ?? '',
                $doc['revision'] ?? null,
                $request->user()->id,
                $doc['version_number'] ?? null,
                $doc['date_modified'] ?? null,
            );
        }

        $count = count($validated['documents']);

        return response()->json([
            'success' => true,
            'message' => $count === 1
                ? '1 document queued for import. Processing in background...'
                : "{$count} documents queued for import. Processing in background...",
        ]);
    }
}
