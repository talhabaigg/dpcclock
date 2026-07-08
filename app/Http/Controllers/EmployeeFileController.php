<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeFile;
use App\Models\EmployeeFileType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EmployeeFileController extends Controller
{
    public function index(Employee $employee)
    {
        $employee->loadMissing(['worktypes', 'kiosks']);

        $allFiles = $employee->employeeFiles()
            ->with(['fileType', 'uploadedBy', 'media'])
            ->orderByDesc('created_at')
            ->get();

        // - Versioned types (has expiry): only show the latest per file type
        // - allow_multiple types (catch-all): show all files
        // - Non-versioned, non-multiple: only one exists anyway
        $seen = [];
        $files = $allFiles->filter(function (EmployeeFile $file) use (&$seen) {
            $key = $file->employee_file_type_id;

            // allow_multiple types always show all files
            if ($file->fileType->allow_multiple) {
                return true;
            }

            // Versioned types only show the latest (first seen, since ordered by created_at desc)
            if ($file->fileType->hasVersions()) {
                if (isset($seen[$key])) {
                    return false;
                }
                $seen[$key] = true;
            }

            return true;
        })->map(fn (EmployeeFile $file) => $this->formatFile($file))->values();

        $allFileTypes = EmployeeFileType::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'has_back_side', 'expiry_requirement', 'requires_completed_date', 'allow_multiple', 'options']);

        // Applicable file types + requirement level, so the card can surface
        // missing mandatory/preferred docs (not just what's already uploaded).
        $requirements = collect($employee->fileComplianceStatus())
            ->filter(fn (array $row) => $row['level'] !== EmployeeFileType::LEVEL_OPTIONAL)
            ->map(fn (array $row) => [
                'file_type_id' => $row['file_type']->id,
                'file_type_name' => $row['file_type']->name,
                'category' => $row['file_type']->category ?: ['Other'],
                'level' => $row['level'],
                'status' => $row['status'],
            ])
            ->values();

        return response()->json([
            'files' => $files,
            'all_file_types' => $allFileTypes,
            'requirements' => $requirements,
        ]);
    }

    public function versions(Employee $employee, EmployeeFileType $fileType)
    {
        $files = $employee->employeeFiles()
            ->where('employee_file_type_id', $fileType->id)
            ->with(['fileType', 'uploadedBy', 'media'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (EmployeeFile $file) => $this->formatFile($file));

        return response()->json(['files' => $files]);
    }

    public function store(Request $request, Employee $employee)
    {
        // "Other" uploads: the user typed a free-text document name + picked a category.
        // Resolve to a per-category shared "Other" file type (created lazily, never seeded),
        // and store the typed name in `notes`. The shared type is inactive + non-matching so
        // it never appears in the picker or counts as a required document.
        if ($request->filled('custom_name')) {
            $request->validate([
                'custom_name' => 'required|string|max:255',
                'custom_category' => 'required|string|max:255',
            ]);

            $category = $request->input('custom_category');
            $otherType = EmployeeFileType::firstOrCreate(
                ['slug' => 'other-'.Str::slug($category)],
                [
                    'name' => 'Other',
                    'category' => [$category],
                    'expiry_requirement' => 'optional',
                    'requires_completed_date' => false,
                    'allow_multiple' => true,
                    'is_active' => false,
                    'conditions' => ['rule_groups' => [[
                        'match' => 'all',
                        'rules' => [['field' => 'employment_type', 'operator' => 'is', 'value' => '__never__']],
                        'result' => 'none',
                    ]]],
                ]
            );

            $request->merge([
                'employee_file_type_id' => $otherType->id,
                'notes' => $request->input('custom_name'),
            ]);
        }

        $validated = $request->validate([
            'employee_file_type_id' => 'required|exists:employee_file_types,id',
            'document_number' => 'nullable|string|max:255',
            'expires_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
            'selected_options' => 'nullable|array',
            'selected_options.*' => 'string|max:255',
            'notes' => 'nullable|string',
            'file_front' => 'required|file|max:10240',
            'file_back' => 'nullable|file|max:10240',
        ]);

        $fileType = EmployeeFileType::findOrFail($validated['employee_file_type_id']);

        // Only versioned (has expiry) or allow_multiple types can have more than one file
        if (!$fileType->hasVersions() && !$fileType->allow_multiple) {
            $existing = $employee->employeeFiles()
                ->where('employee_file_type_id', $fileType->id)
                ->exists();

            if ($existing) {
                return redirect()->back()->withErrors([
                    'employee_file_type_id' => 'This file type already exists for this employee. Delete the existing file first or choose a different type.',
                ]);
            }
        }

        $employeeFile = $employee->employeeFiles()->create([
            'employee_file_type_id' => $validated['employee_file_type_id'],
            'document_number' => $validated['document_number'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'completed_at' => $validated['completed_at'] ?? null,
            'selected_options' => $validated['selected_options'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'uploaded_by' => auth()->id(),
        ]);

        $employeeFile->addMedia($request->file('file_front'))->toMediaCollection('file_front');

        if ($request->hasFile('file_back') && $fileType->has_back_side) {
            $employeeFile->addMedia($request->file('file_back'))->toMediaCollection('file_back');
        }

        return redirect()->back()->with('success', 'File uploaded successfully.');
    }

    public function update(Request $request, Employee $employee, EmployeeFile $employeeFile)
    {
        abort_unless($employeeFile->employee_id === $employee->id, 404);

        $validated = $request->validate([
            'document_number' => 'nullable|string|max:255',
            'expires_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
            'notes' => 'nullable|string',
            'file_front' => 'nullable|file|max:10240',
            'file_back' => 'nullable|file|max:10240',
        ]);

        $employeeFile->update([
            'document_number' => $validated['document_number'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'completed_at' => $validated['completed_at'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        if ($request->hasFile('file_front')) {
            $employeeFile->addMedia($request->file('file_front'))->toMediaCollection('file_front');
        }

        if ($request->hasFile('file_back')) {
            $employeeFile->addMedia($request->file('file_back'))->toMediaCollection('file_back');
        }

        return redirect()->back()->with('success', 'File updated successfully.');
    }

    public function destroy(Employee $employee, EmployeeFile $employeeFile)
    {
        abort_unless($employeeFile->employee_id === $employee->id, 404);

        $employeeFile->delete();

        return redirect()->back()->with('success', 'File deleted successfully.');
    }

    private function formatFile(EmployeeFile $file): array
    {
        $type = $file->fileType;
        // Shared per-category "Other" type: free-text doc whose real name lives in `notes`.
        $isOther = $type && ! $type->is_active && $type->name === 'Other';
        // Catch-all / "Other" types are not versioned — each upload is its own document.
        $hasVersions = $type && $type->hasVersions() && ! $type->allow_multiple;
        $versionCount = $hasVersions
            ? EmployeeFile::where('employee_id', $file->employee_id)
                ->where('employee_file_type_id', $file->employee_file_type_id)
                ->count()
            : 1;
        $frontMedia = $file->getFirstMedia('file_front');
        $backMedia = $file->getFirstMedia('file_back');

        return [
            'id' => $file->id,
            'document_number' => $file->document_number,
            'expires_at' => $file->expires_at?->toDateString(),
            'completed_at' => $file->completed_at?->toDateString(),
            'status' => $file->getStatus(),
            'notes' => $file->notes,
            'uploaded_by' => $file->uploadedBy?->name,
            'created_at' => $file->created_at->toDateString(),
            'selected_options' => $file->selected_options,
            'file_type' => [
                'id' => $type?->id ?? 0,
                'name' => $isOther && $file->notes ? $file->notes : ($type?->name ?? 'Unknown'),
                'category' => $type?->category,
                'has_back_side' => $type?->has_back_side ?? false,
                'expiry_requirement' => $type?->expiry_requirement ?? 'optional',
                'requires_completed_date' => $type?->requires_completed_date ?? false,
                'options' => $type?->options,
                'has_versions' => $hasVersions,
                'is_other' => $isOther,
            ],
            'version_count' => $versionCount,
            'front_url' => $frontMedia ? route('employees.files.download', [$file->employee_id, $file->id, 'file_front']) : null,
            'back_url' => $backMedia ? route('employees.files.download', [$file->employee_id, $file->id, 'file_back']) : null,
            'front_preview_url' => $frontMedia ? route('employees.files.download', [$file->employee_id, $file->id, 'file_front'], false) . '?inline=1' : null,
            'back_preview_url' => $backMedia ? route('employees.files.download', [$file->employee_id, $file->id, 'file_back'], false) . '?inline=1' : null,
            'front_filename' => $frontMedia?->file_name,
            'back_filename' => $backMedia?->file_name,
            'front_mime_type' => $frontMedia?->mime_type,
            'back_mime_type' => $backMedia?->mime_type,
            'front_size' => $frontMedia?->size,
            'back_size' => $backMedia?->size,
        ];
    }

    /**
     * API endpoint for bulk importing employee files.
     * Accepts multipart/form-data with employee_id, file type, metadata, and file.
     *
     * Pass replace=1 to update an existing record instead of skipping.
     */
    public function apiImportFile(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'employee_file_type_id' => 'required|integer|exists:employee_file_types,id',
            'document_number' => 'nullable|string|max:255',
            'expires_at' => 'nullable|date',
            'completed_at' => 'nullable|date',
            'selected_options' => 'nullable|string', // JSON string from multipart
            'notes' => 'nullable|string',
            'replace' => 'nullable|boolean',
            'file_front' => 'required|file|max:20480',
            'file_back' => 'nullable|file|max:20480',
        ]);

        $employee = Employee::findOrFail($validated['employee_id']);
        $replace = (bool) ($validated['replace'] ?? false);

        $selectedOptions = null;
        if (!empty($validated['selected_options'])) {
            $selectedOptions = json_decode($validated['selected_options'], true);
            if (!is_array($selectedOptions)) {
                $selectedOptions = null;
            }
        }

        // Check for existing record with same employee + file type
        $existing = $employee->employeeFiles()
            ->where('employee_file_type_id', $validated['employee_file_type_id'])
            ->first();

        if ($existing && !$replace) {
            return response()->json([
                'status' => 'skipped',
                'reason' => 'already_exists',
                'employee_file_id' => $existing->id,
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'file_type_id' => $validated['employee_file_type_id'],
            ], 200);
        }

        if ($existing && $replace) {
            $existing->update([
                'document_number' => $validated['document_number'] ?? null,
                'expires_at' => $validated['expires_at'] ?? null,
                'completed_at' => $validated['completed_at'] ?? null,
                'selected_options' => $selectedOptions,
                'notes' => $validated['notes'] ?? null,
                'uploaded_by' => auth()->id(),
            ]);

            $existing->addMedia($request->file('file_front'))->toMediaCollection('file_front');

            if ($request->hasFile('file_back')) {
                $existing->addMedia($request->file('file_back'))->toMediaCollection('file_back');
            }

            return response()->json([
                'status' => 'replaced',
                'employee_file_id' => $existing->id,
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'file_type_id' => $validated['employee_file_type_id'],
            ], 200);
        }

        $employeeFile = $employee->employeeFiles()->create([
            'employee_file_type_id' => $validated['employee_file_type_id'],
            'document_number' => $validated['document_number'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'completed_at' => $validated['completed_at'] ?? null,
            'selected_options' => $selectedOptions,
            'notes' => $validated['notes'] ?? null,
            'uploaded_by' => auth()->id(),
        ]);

        $employeeFile->addMedia($request->file('file_front'))->toMediaCollection('file_front');

        if ($request->hasFile('file_back')) {
            $employeeFile->addMedia($request->file('file_back'))->toMediaCollection('file_back');
        }

        return response()->json([
            'status' => 'created',
            'employee_file_id' => $employeeFile->id,
            'employee_id' => $employee->id,
            'employee_name' => $employee->name,
            'file_type_id' => $validated['employee_file_type_id'],
        ], 201);
    }

    /**
     * API endpoint to attach a back-side file to an existing employee file.
     * Looks up by employee_id + employee_file_type_id.
     */
    public function apiImportFileBack(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'employee_file_type_id' => 'required|integer|exists:employee_file_types,id',
            'file_back' => 'required|file|max:20480',
        ]);

        $employee = Employee::findOrFail($validated['employee_id']);

        $existing = $employee->employeeFiles()
            ->where('employee_file_type_id', $validated['employee_file_type_id'])
            ->first();

        if (!$existing) {
            return response()->json([
                'status' => 'not_found',
                'message' => 'No existing file record found for this employee + file type. Upload the front side first.',
            ], 404);
        }

        $existing->addMedia($request->file('file_back'))->toMediaCollection('file_back');

        return response()->json([
            'status' => 'back_attached',
            'employee_file_id' => $existing->id,
            'employee_id' => $employee->id,
            'employee_name' => $employee->name,
            'file_type_id' => $validated['employee_file_type_id'],
        ], 200);
    }

    public function download(Employee $employee, EmployeeFile $employeeFile, string $collection)
    {
        abort_unless($employeeFile->employee_id === $employee->id, 404);
        abort_unless(in_array($collection, ['file_front', 'file_back']), 400);

        $media = $employeeFile->getFirstMedia($collection);
        abort_unless($media, 404);

        $filename = $media->file_name;
        $mimeType = $media->mime_type ?: 'application/octet-stream';
        $disposition = request()->boolean('inline') ? 'inline' : 'attachment';

        if ($media->disk === 's3' && $disposition === 'inline' && $mimeType === 'application/pdf') {
            $stream = Storage::disk('s3')->readStream($media->getPathRelativeToRoot());
            abort_unless($stream, 404);

            return response()->stream(function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, 200, [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'inline; filename="'.addslashes($filename).'"',
                'Cache-Control' => 'private, max-age=300',
            ]);
        }

        if ($media->disk === 's3') {
            return redirect($media->getTemporaryUrl(now()->addMinutes(30), '', [
                'ResponseContentDisposition' => $disposition.'; filename="'.addslashes($filename).'"',
                'ResponseContentType' => $mimeType,
            ]));
        }

        if ($disposition === 'inline') {
            return response()->file($media->getPath(), [
                'Content-Type' => $mimeType,
                'Content-Disposition' => 'inline; filename="'.addslashes($filename).'"',
            ]);
        }

        return response()->download($media->getPath(), $filename, [
            'Content-Type' => $mimeType,
        ]);
    }
}
