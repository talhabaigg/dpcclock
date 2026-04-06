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
                'status' => $file->getStatus(),
                'notes' => $file->notes,
                'uploaded_by' => $file->uploadedBy?->name,
                'created_at' => $file->created_at->toDateString(),
                'file_type' => [
                    'id' => $file->fileType->id,
                    'name' => $file->fileType->name,
                    'category' => $file->fileType->category,
                    'has_back_side' => $file->fileType->has_back_side,
                ],
                'front_url' => $file->getFrontUrl(),
                'back_url' => $file->getBackUrl(),
                'front_filename' => $file->getFirstMedia('file_front')?->file_name,
                'back_filename' => $file->getFirstMedia('file_back')?->file_name,
            ]);

        $allFileTypes = EmployeeFileType::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'has_back_side']);

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
            'notes' => 'nullable|string',
            'file_front' => 'required|file|max:10240',
            'file_back' => 'nullable|file|max:10240',
        ]);

        $fileType = EmployeeFileType::findOrFail($validated['employee_file_type_id']);

        $employeeFile = $employee->employeeFiles()->create([
            'employee_file_type_id' => $validated['employee_file_type_id'],
            'document_number' => $validated['document_number'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
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
            'notes' => 'nullable|string',
            'file_front' => 'nullable|file|max:10240',
            'file_back' => 'nullable|file|max:10240',
        ]);

        $employeeFile->update([
            'document_number' => $validated['document_number'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
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
