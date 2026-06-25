<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class EmployeeDocumentController extends Controller
{
    public function store(Request $request, Employee $employee)
    {
        Gate::authorize('view', $employee);

        $request->validate([
            'files'   => 'required|array|min:1',
            'files.*' => 'file|max:20480',
        ]);

        foreach ($request->file('files') as $file) {
            $employee->addMedia($file)
                ->withCustomProperties(['uploaded_by' => auth()->id()])
                ->toMediaCollection('documents');
        }

        return redirect()->back()->with('success', 'Documents uploaded.');
    }

    public function destroy(Employee $employee, Media $media)
    {
        Gate::authorize('view', $employee);
        abort_unless(
            $media->model_type === Employee::class
                && (int) $media->model_id === $employee->id
                && $media->collection_name === 'documents',
            404,
        );

        $media->delete();

        return redirect()->back()->with('success', 'Document deleted.');
    }

    public function download(Employee $employee, Media $media)
    {
        Gate::authorize('view', $employee);
        abort_unless(
            $media->model_type === Employee::class
                && (int) $media->model_id === $employee->id
                && $media->collection_name === 'documents',
            404,
        );

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
                'Content-Type'        => $mimeType,
                'Content-Disposition' => 'inline; filename="'.addslashes($filename).'"',
                'Cache-Control'       => 'private, max-age=300',
            ]);
        }

        if ($media->disk === 's3') {
            return redirect($media->getTemporaryUrl(now()->addMinutes(30), '', [
                'ResponseContentDisposition' => $disposition.'; filename="'.addslashes($filename).'"',
                'ResponseContentType'        => $mimeType,
            ]));
        }

        if ($disposition === 'inline') {
            return response()->file($media->getPath(), [
                'Content-Type'        => $mimeType,
                'Content-Disposition' => 'inline; filename="'.addslashes($filename).'"',
            ]);
        }

        return response()->download($media->getPath(), $filename, [
            'Content-Type' => $mimeType,
        ]);
    }
}
