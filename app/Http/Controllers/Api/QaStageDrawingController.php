<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QaStageDrawing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;

class QaStageDrawingController extends Controller
{
    public function index(Request $request)
    {
        $query = QaStageDrawing::with(['qaStage', 'observations.createdBy', 'createdBy', 'updatedBy']);

        if ($request->has('qa_stage_id')) {
            $query->where('qa_stage_id', $request->qa_stage_id);
        }

        $drawings = $query->orderBy('created_at', 'desc')->get();

        return response()->json($drawings);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'qa_stage_id' => 'required|exists:qa_stages,id',
            'name' => 'required|string|max:255',
            'file' => 'required|file|max:51200', // 50MB max
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $directory = 'qa-drawings/' . $validated['qa_stage_id'];

        try {
            $filePath = $file->storeAs($directory, time() . '_' . $fileName, 'public');

            if (!$filePath) {
                Log::error('Failed to upload file', ['fileName' => $fileName]);
                return response()->json(['message' => 'Failed to upload file.'], 500);
            }

            $drawing = QaStageDrawing::create([
                'qa_stage_id' => $validated['qa_stage_id'],
                'name' => $validated['name'],
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);

            $drawing->load(['qaStage', 'createdBy']);

            return response()->json($drawing, 201);
        } catch (\Exception $e) {
            Log::error('Upload error', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to upload: ' . $e->getMessage()], 500);
        }
    }

    public function show(QaStageDrawing $qaStageDrawing)
    {
        $qaStageDrawing->load([
            'qaStage.location',
            'observations.createdBy',
            'observations.updatedBy',
            'createdBy',
            'updatedBy',
        ]);

        return response()->json($qaStageDrawing);
    }

    public function file(Request $request, QaStageDrawing $qaStageDrawing)
    {
        Log::info('File download requested', [
            'drawing_id' => $qaStageDrawing->id,
            'file_path' => $qaStageDrawing->file_path,
            'user_id' => $request->user()?->id,
        ]);

        if (!Storage::disk('public')->exists($qaStageDrawing->file_path)) {
            Log::error('File not found on disk', ['path' => $qaStageDrawing->file_path]);
            return response()->json(['message' => 'File not found.'], 404);
        }

        return Storage::disk('public')->response(
            $qaStageDrawing->file_path,
            $qaStageDrawing->file_name,
            ['Content-Type' => $qaStageDrawing->file_type]
        );
    }

    public function update(Request $request, QaStageDrawing $qaStageDrawing)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'file' => 'sometimes|file|max:51200',
        ]);

        if ($request->hasFile('file')) {
            Storage::disk('public')->delete($qaStageDrawing->file_path);

            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $directory = 'qa-drawings/' . $qaStageDrawing->qa_stage_id;

            $filePath = $file->storeAs($directory, time() . '_' . $fileName, 'public');

            $qaStageDrawing->update([
                'name' => $validated['name'] ?? $qaStageDrawing->name,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);
        } else {
            $qaStageDrawing->update([
                'name' => $validated['name'] ?? $qaStageDrawing->name,
            ]);
        }

        $qaStageDrawing->load(['qaStage', 'createdBy', 'updatedBy']);

        return response()->json($qaStageDrawing);
    }

    public function destroy(QaStageDrawing $qaStageDrawing)
    {
        Storage::disk('public')->delete($qaStageDrawing->file_path);
        $qaStageDrawing->delete();

        return response()->json(['message' => 'Drawing deleted successfully']);
    }

    private function corsHeaders(Request $request): array
    {
        $origin = $request->header('Origin', '*');

        return [
            'Access-Control-Allow-Origin' => $origin,
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Authorization, Content-Type, X-Requested-With',
        ];
    }
}
