<?php

namespace App\Http\Controllers;

use App\Models\ApplicationPhaseForm;
use App\Models\EmploymentApplication;
use App\Models\FormTemplate;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class ApplicationPhaseFormController extends Controller
{
    public function index()
    {
        $mappings = ApplicationPhaseForm::query()
            ->with('formTemplate:id,name')
            ->orderBy('model_type')
            ->orderBy('status')
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('application-phase-forms/index', [
            'mappings' => $mappings,
            'statuses' => $this->statusOptions(),
            'modelTypes' => $this->modelTypeOptions(),
            'formTemplates' => FormTemplate::active()
                ->where('model_type', EmploymentApplication::class)
                ->orderBy('name')
                ->get(['id', 'name']),
            'roles' => Role::orderBy('name')->get(['id', 'name']),
            'users' => User::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);

        ApplicationPhaseForm::create($validated);

        return redirect()->route('application-phase-forms.index')->with('success', 'Phase form mapping created.');
    }

    public function update(Request $request, ApplicationPhaseForm $applicationPhaseForm)
    {
        $validated = $this->validateInput($request);

        $applicationPhaseForm->update($validated);

        return redirect()->route('application-phase-forms.index')->with('success', 'Phase form mapping updated.');
    }

    public function destroy(ApplicationPhaseForm $applicationPhaseForm)
    {
        $applicationPhaseForm->delete();

        return redirect()->route('application-phase-forms.index')->with('success', 'Phase form mapping deleted.');
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'model_type' => ['required', 'string', 'in:' . EmploymentApplication::class],
            'status' => ['required', 'string', 'in:' . implode(',', EmploymentApplication::STATUSES)],
            'form_template_id' => ['required', 'integer', 'exists:form_templates,id'],
            'assignee_strategy' => ['required', 'in:role,user'],
            'assignee_value' => ['required', 'string', 'max:255'],
            'is_required' => ['boolean'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);
    }

    private function statusOptions(): array
    {
        // Statuses that meaningfully accept a phase form. Exclude terminal /
        // special-flow statuses where adding a form makes no sense.
        $excluded = [
            EmploymentApplication::STATUS_DECLINED,
            EmploymentApplication::STATUS_CONTRACT_SENT,
            EmploymentApplication::STATUS_CONTRACT_SIGNED,
            EmploymentApplication::STATUS_ONBOARDED,
        ];

        return array_values(array_diff(EmploymentApplication::STATUSES, $excluded));
    }

    private function modelTypeOptions(): array
    {
        return [
            ['value' => EmploymentApplication::class, 'label' => 'Employment Enquiry'],
        ];
    }
}
