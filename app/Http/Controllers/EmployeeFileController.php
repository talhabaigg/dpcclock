<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeFile;
use App\Models\EmployeeFileType;
use Illuminate\Http\Request;

class EmployeeFileController extends Controller
{
    public function index(Employee $employee)
    {
        $employee->loadMissing(['worktypes', 'kiosks']);

        $files = $employee->employeeFiles()
            ->with(['fileType', 'uploadedBy', 'media'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (EmployeeFile $file) => [
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
                    'id' => $file->fileType->id,
                    'name' => $file->fileType->name,
                    'category' => $file->fileType->category,
                    'has_back_side' => $file->fileType->has_back_side,
                    'expiry_requirement' => $file->fileType->expiry_requirement,
                    'requires_completed_date' => $file->fileType->requires_completed_date,
                    'options' => $file->fileType->options,
                ],
                'front_url' => $file->getFrontUrl(),
                'back_url' => $file->getBackUrl(),
                'front_filename' => $file->getFirstMedia('file_front')?->file_name,
                'back_filename' => $file->getFirstMedia('file_back')?->file_name,
            ]);

        $allFileTypes = EmployeeFileType::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'has_back_side', 'expiry_requirement', 'requires_completed_date', 'options']);

        return response()->json([
            'files' => $files,
            'all_file_types' => $allFileTypes,
        ]);
    }

    public function store(Request $request, Employee $employee)
    {
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

        if (app()->environment('production')) {
            return redirect($media->getTemporaryUrl(now()->addMinutes(30)));
        }

        return $media;
    }
}
