<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\QaStage;
use Illuminate\Http\Request;
use Inertia\Inertia;

class QaStageController extends Controller
{
    public function index()
    {
        $user = auth()->user();

        $locationsQuery = Location::where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });

        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }

        $locations = $locationsQuery->get();

        $qaStages = QaStage::with(['location', 'createdBy', 'drawings'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('qa-stages/index', [
            'qaStages' => $qaStages,
            'locations' => $locations,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'name' => 'required|string|max:255',
        ]);

        $qaStage = QaStage::create($validated);

        return redirect()->route('qa-stages.show', $qaStage->id)
            ->with('success', 'QA Stage created successfully.');
    }

    public function show(QaStage $qaStage)
    {
        $qaStage->load(['location', 'drawings.createdBy', 'createdBy']);

        return Inertia::render('qa-stages/show', [
            'qaStage' => $qaStage,
        ]);
    }

    public function destroy(QaStage $qaStage)
    {
        $qaStage->delete();

        return redirect()->route('qa-stages.index')
            ->with('success', 'QA Stage deleted successfully.');
    }
}
