<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QaStage;
use Illuminate\Http\Request;

class QaStageController extends Controller
{
    public function index()
    {
        $qaStages = QaStage::with(['location', 'createdBy', 'updatedBy', 'drawings'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($qaStages);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'name' => 'required|string|max:255',
        ]);

        $qaStage = QaStage::create($validated);
        $qaStage->load(['location', 'createdBy']);

        return response()->json($qaStage, 201);
    }

    public function show(QaStage $qaStage)
    {
        $qaStage->load(['location', 'createdBy', 'updatedBy', 'drawings.createdBy']);

        return response()->json($qaStage);
    }

    public function update(Request $request, QaStage $qaStage)
    {
        $validated = $request->validate([
            'location_id' => 'sometimes|required|exists:locations,id',
            'name' => 'sometimes|required|string|max:255',
        ]);

        $qaStage->update($validated);
        $qaStage->load(['location', 'createdBy', 'updatedBy']);

        return response()->json($qaStage);
    }

    public function destroy(QaStage $qaStage)
    {
        $qaStage->delete();

        return response()->json(['message' => 'QA Stage deleted successfully']);
    }
}
