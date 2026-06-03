<?php

namespace App\Http\Controllers;

use App\Models\EmploymentApplication;
use App\Models\FormTemplate;
use App\Models\Injury;
use App\Models\ModelTriggerForm;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

class ModelTriggerFormController extends Controller
{
    public function index()
    {
        $mappings = ModelTriggerForm::query()
            ->with('formTemplate:id,name,model_type,is_sendable')
            ->orderBy('model_type')
            ->orderBy('trigger_key')
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('model-trigger-forms/index', [
            'mappings' => $mappings,
            'modelTypes' => $this->modelTypeOptions(),
            'triggerKeysByModel' => $this->triggerKeysByModel(),
            'subjectSourcesByModel' => $this->subjectSourcesByModel(),
            'formTemplates' => FormTemplate::active()
                ->orderBy('name')
                ->get(['id', 'name', 'model_type', 'is_sendable']),
            'permissions' => Permission::orderBy('name')->get(['id', 'name']),
            'users' => User::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateInput($request);

        ModelTriggerForm::create($validated);

        return redirect()->route('model-trigger-forms.index')->with('success', 'Trigger form mapping created.');
    }

    public function update(Request $request, ModelTriggerForm $modelTriggerForm)
    {
        $validated = $this->validateInput($request);

        $modelTriggerForm->update($validated);

        return redirect()->route('model-trigger-forms.index')->with('success', 'Trigger form mapping updated.');
    }

    public function destroy(ModelTriggerForm $modelTriggerForm)
    {
        $modelTriggerForm->delete();

        return redirect()->route('model-trigger-forms.index')->with('success', 'Trigger form mapping deleted.');
    }

    private function validateInput(Request $request): array
    {
        $modelTypes = array_keys($this->triggerKeysByModel());
        $allTriggerKeys = collect($this->triggerKeysByModel())->flatten()->unique()->all();
        $subjectSources = $this->subjectSourcesByModel();

        return $request->validate([
            'model_type' => ['required', 'string', 'in:' . implode(',', $modelTypes)],
            'trigger_key' => ['required', 'string', 'in:' . implode(',', $allTriggerKeys)],
            'form_template_id' => ['required', 'integer', 'exists:form_templates,id'],
            'subject_source' => [
                'nullable',
                'string',
                function (string $attr, mixed $value, \Closure $fail) use ($request, $subjectSources) {
                    $valid = array_keys($subjectSources[$request->input('model_type')] ?? []);
                    if ($value !== null && $value !== '' && ! in_array($value, $valid, true)) {
                        $fail("Subject source '{$value}' is not valid for the chosen model type.");
                    }
                },
            ],
            'dispatch_mode' => ['nullable', 'in:auto,on_demand'],
            'min_submissions' => ['nullable', 'integer', 'min:1'],
            'assignee_strategy' => ['required', 'in:permission,user'],
            'assignee_value' => ['required', 'string', 'max:255'],
            'is_required' => ['boolean'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);
    }

    private function modelTypeOptions(): array
    {
        return [
            ['value' => EmploymentApplication::class, 'label' => 'Employment Enquiry'],
            ['value' => Injury::class, 'label' => 'Injury Report'],
        ];
    }

    /**
     * Map of model class → trigger keys that can fire forms.
     *
     * For models with a status workflow, the trigger keys are the statuses.
     * For models without one, a sentinel like 'created' is used.
     *
     * @return array<string, array<int, string>>
     */
    private function triggerKeysByModel(): array
    {
        $appExcluded = [
            EmploymentApplication::STATUS_DECLINED,
            EmploymentApplication::STATUS_CONTRACT_SENT,
            EmploymentApplication::STATUS_CONTRACT_SIGNED,
            EmploymentApplication::STATUS_ONBOARDED,
        ];

        return [
            EmploymentApplication::class => array_values(array_diff(EmploymentApplication::STATUSES, $appExcluded)),
            Injury::class => ['created'],
        ];
    }

    /**
     * Map of model class → valid subject_source keys. Each key names a relation
     * on the formable that returns the collection (or single model) the
     * dispatcher fans out over. The value is the human label for the UI.
     *
     * Empty array (or absent model_type) means the model has no fan-out
     * options — the UI hides the "Subject" field for that model.
     *
     * @return array<string, array<string, string>>
     */
    private function subjectSourcesByModel(): array
    {
        return [
            EmploymentApplication::class => [
                'references' => 'One form per reference',
            ],
            Injury::class => [],
        ];
    }
}
