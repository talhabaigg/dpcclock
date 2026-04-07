<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInjuryRequest;
use App\Http\Requests\UpdateInjuryRequest;
use App\Models\Employee;
use App\Models\Injury;
use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;

class InjuryController extends Controller
{
    public function index(Request $request)
    {
        $query = Injury::with(['employee', 'location', 'representative', 'creator']);

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->location_id);
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }
        if ($request->filled('incident')) {
            $query->where('incident', $request->incident);
        }
        if ($request->filled('report_type')) {
            $query->where('report_type', $request->report_type);
        }
        if ($request->filled('work_cover_claim')) {
            $query->where('work_cover_claim', $request->boolean('work_cover_claim'));
        }
        if ($request->filled('status')) {
            if ($request->status === 'locked') {
                $query->whereNotNull('locked_at');
            } elseif ($request->status === 'active') {
                $query->whereNull('locked_at');
            }
        }

        $injuries = $query->latest('occurred_at')->paginate(25)->withQueryString();

        return Inertia::render('injury-register/index', [
            'injuries' => $injuries,
            'filters' => $request->only(['location_id', 'employee_id', 'incident', 'report_type', 'work_cover_claim', 'status']),
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'employees' => Employee::orderBy('name')->get(['id', 'name', 'preferred_name']),
            'incidentOptions' => Injury::INCIDENT_OPTIONS,
            'reportTypeOptions' => Injury::REPORT_TYPE_OPTIONS,
        ]);
    }

    public function create()
    {
        return Inertia::render('injury-register/form', [
            'injury' => null,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'employees' => Employee::orderBy('name')->get(['id', 'name', 'preferred_name', 'employment_type']),
            'options' => $this->getFormOptions(),
        ]);
    }

    public function store(StoreInjuryRequest $request)
    {
        $data = $request->validated();
        $data['id_formal'] = Injury::generateFormalId();
        $data['created_by'] = auth()->id();

        unset($data['files']);

        $injury = Injury::create($data);

        if ($request->hasFile('files')) {
            foreach ($request->file('files') as $file) {
                $injury->addMedia($file)->toMediaCollection('files');
            }
        }

        return redirect()->route('injury-register.index')
            ->with('success', 'Injury report created successfully.');
    }

    public function show(Injury $injury)
    {
        $injury->load(['employee', 'location', 'representative', 'creator', 'media']);

        return Inertia::render('injury-register/show', [
            'injury' => $injury,
            'options' => $this->getFormOptions(),
        ]);
    }

    public function edit(Injury $injury)
    {
        if ($injury->isLocked()) {
            return redirect()->route('injury-register.show', $injury)
                ->with('error', 'This record is locked and cannot be edited.');
        }

        $injury->load('media');

        return Inertia::render('injury-register/form', [
            'injury' => $injury,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'employees' => Employee::orderBy('name')->get(['id', 'name', 'preferred_name', 'employment_type']),
            'options' => $this->getFormOptions(),
        ]);
    }

    public function update(UpdateInjuryRequest $request, Injury $injury)
    {
        $data = $request->validated();
        $data['updated_by'] = auth()->id();

        unset($data['files']);

        $injury->update($data);

        if ($request->hasFile('files')) {
            foreach ($request->file('files') as $file) {
                $injury->addMedia($file)->toMediaCollection('files');
            }
        }

        return redirect()->route('injury-register.show', $injury)
            ->with('success', 'Injury report updated successfully.');
    }

    public function destroy(Injury $injury)
    {
        if ($injury->isLocked()) {
            return back()->with('error', 'This record is locked and cannot be deleted.');
        }

        $injury->delete();

        return redirect()->route('injury-register.index')
            ->with('success', 'Injury report deleted.');
    }

    public function updateClassification(Request $request, Injury $injury)
    {
        $validated = $request->validate([
            'work_cover_claim' => ['required', 'boolean'],
            'work_days_missed' => ['nullable', 'integer', 'min:0'],
            'report_type' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(Injury::REPORT_TYPE_OPTIONS))],
        ]);

        $injury->update($validated);

        return back()->with('success', 'Classification updated.');
    }

    public function lock(Injury $injury)
    {
        $injury->update(['locked_at' => now()]);

        return back()->with('success', 'Record locked.');
    }

    public function unlock(Injury $injury)
    {
        $injury->update(['locked_at' => null]);

        return back()->with('success', 'Record unlocked.');
    }

    protected function getFormOptions(): array
    {
        return [
            'incidents' => Injury::INCIDENT_OPTIONS,
            'reportTypes' => Injury::REPORT_TYPE_OPTIONS,
            'treatmentExternal' => Injury::TREATMENT_EXTERNAL_OPTIONS,
            'natures' => Injury::NATURE_OPTIONS,
            'mechanisms' => Injury::MECHANISM_OPTIONS,
            'agencies' => Injury::AGENCY_OPTIONS,
            'contributions' => Injury::CONTRIBUTION_OPTIONS,
            'correctiveActions' => Injury::CORRECTIVE_ACTION_OPTIONS,
        ];
    }
}
