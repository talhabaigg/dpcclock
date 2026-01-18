<?php

namespace App\Http\Controllers;

use App\Models\QaStage;
use App\Models\QaStageDrawing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class QaStageDrawingController extends Controller
{
    public function store(Request $request, QaStage $qaStage)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'file' => 'required|file|max:51200', // 50MB max
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $directory = 'qa-drawings/' . $qaStage->id;

        try {
            // Store file locally in public storage
            $filePath = $file->storeAs($directory, time() . '_' . $fileName, 'public');

            if (!$filePath) {
                Log::error('Failed to upload file', ['fileName' => $fileName]);
                return redirect()->back()->with('error', 'Failed to upload file.');
            }

            $drawing = QaStageDrawing::create([
                'qa_stage_id' => $qaStage->id,
                'name' => $validated['name'],
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);

            return redirect()->back()->with('success', 'Drawing uploaded successfully.');
        } catch (\Exception $e) {
            Log::error('Upload error', ['error' => $e->getMessage()]);
            return redirect()->back()->with('error', 'Failed to upload: ' . $e->getMessage());
        }
    }

    public function destroy(QaStageDrawing $drawing)
    {
        // Delete file from storage
        Storage::disk('public')->delete($drawing->file_path);

        $drawing->delete();

        return redirect()->back()->with('success', 'Drawing deleted successfully.');
    }

    public function download(QaStageDrawing $drawing)
    {
        $path = Storage::disk('public')->path($drawing->file_path);

        if (!file_exists($path)) {
            return redirect()->back()->with('error', 'File not found.');
        }

        return response()->download($path, $drawing->file_name);
    }
}
