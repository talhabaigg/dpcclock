<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use App\Services\SignedDocumentPdfService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocumentTemplateController extends Controller
{
    public function index()
    {
        $templates = DocumentTemplate::query()
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'is_active', 'created_at', 'updated_at']);

        return Inertia::render('document-templates/index', [
            'templates' => $templates,
        ]);
    }

    public function create()
    {
        return Inertia::render('document-templates/create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'body_json' => 'required|string',
            'body_html' => 'required|string',
            'placeholders' => 'nullable|array',
            'placeholders.*.key' => 'required|string',
            'placeholders.*.label' => 'required|string',
            'placeholders.*.type' => 'nullable|string|in:text,textarea,date,number,email,phone,dropdown,radio,checkbox',
            'placeholders.*.required' => 'nullable|boolean',
            'placeholders.*.options' => 'nullable|array',
            'placeholders.*.options.*' => 'string',
        ]);

        $template = DocumentTemplate::create([
            ...$validated,
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        return redirect()->route('document-templates.index')
            ->with('success', 'Template created successfully.');
    }

    public function edit(DocumentTemplate $documentTemplate)
    {
        return Inertia::render('document-templates/edit', [
            'template' => $documentTemplate,
        ]);
    }

    public function update(Request $request, DocumentTemplate $documentTemplate)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|max:255',
            'body_json' => 'required|string',
            'body_html' => 'required|string',
            'placeholders' => 'nullable|array',
            'placeholders.*.key' => 'required|string',
            'placeholders.*.label' => 'required|string',
            'placeholders.*.type' => 'nullable|string|in:text,textarea,date,number,email,phone,dropdown,radio,checkbox',
            'placeholders.*.required' => 'nullable|boolean',
            'placeholders.*.options' => 'nullable|array',
            'placeholders.*.options.*' => 'string',
            'is_active' => 'boolean',
        ]);

        $documentTemplate->update([
            ...$validated,
            'updated_by' => auth()->id(),
        ]);

        return redirect()->route('document-templates.index')
            ->with('success', 'Template updated successfully.');
    }

    public function destroy(DocumentTemplate $documentTemplate)
    {
        $documentTemplate->delete();

        return redirect()->route('document-templates.index')
            ->with('success', 'Template deleted successfully.');
    }

    public function previewPdf(DocumentTemplate $documentTemplate, SignedDocumentPdfService $pdfService)
    {
        $pdfContent = $pdfService->generateTemplatePreview($documentTemplate->body_html);
        $filename = str()->slug($documentTemplate->name) . '-preview.pdf';

        return response($pdfContent, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
