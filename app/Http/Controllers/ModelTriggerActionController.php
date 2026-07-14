<?php

namespace App\Http\Controllers;

use App\Contracts\ProvidesFormPlaceholders;
use App\Models\EmploymentApplication;
use App\Models\FormTemplate;
use App\Models\Injury;
use App\Models\ModelTriggerAction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

class ModelTriggerActionController extends Controller
{
    public function index()
    {
        $actions = ModelTriggerAction::query()
            ->with('formTemplate:id,name,model_type,is_sendable')
            ->orderBy('model_type')
            ->orderBy('trigger_key')
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('trigger-actions/index', [
            'actions' => $actions,
            'modelTypes' => $this->modelTypeOptions(),
        ]);
    }

    public function create()
    {
        return Inertia::render('trigger-actions/builder', $this->builderProps());
    }

    public function edit(ModelTriggerAction $modelTriggerAction)
    {
        return Inertia::render('trigger-actions/builder', [
            ...$this->builderProps(),
            'action' => $modelTriggerAction,
        ]);
    }

    public function store(Request $request)
    {
        ModelTriggerAction::create($this->validateInput($request));

        return redirect()->route('model-trigger-actions.index')->with('success', 'Trigger action created.');
    }

    public function update(Request $request, ModelTriggerAction $modelTriggerAction)
    {
        $modelTriggerAction->update($this->validateInput($request));

        return redirect()->route('model-trigger-actions.index')->with('success', 'Trigger action updated.');
    }

    public function destroy(ModelTriggerAction $modelTriggerAction)
    {
        $modelTriggerAction->delete();

        return redirect()->route('model-trigger-actions.index')->with('success', 'Trigger action deleted.');
    }

    private function builderProps(): array
    {
        return [
            'modelTypes' => $this->modelTypeOptions(),
            'triggerKeysByModel' => $this->triggerKeysByModel(),
            'subjectSourcesByModel' => $this->subjectSourcesByModel(),
            'placeholdersByModel' => $this->placeholdersByModel(),
            'formTemplates' => FormTemplate::active()
                ->orderBy('name')
                ->get(['id', 'name', 'model_type', 'is_sendable']),
            'permissions' => Permission::orderBy('name')->get(['id', 'name']),
            'users' => User::orderBy('name')->get(['id', 'name']),
        ];
    }

    private function validateInput(Request $request): array
    {
        $modelTypes = array_keys($this->triggerKeysByModel());
        $allTriggerKeys = collect($this->triggerKeysByModel())->flatten()->unique()->all();
        $subjectSources = $this->subjectSourcesByModel();

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'model_type' => ['required', 'string', 'in:' . implode(',', $modelTypes)],
            'trigger_key' => ['required', 'string', 'in:' . implode(',', $allTriggerKeys)],
            'action_type' => ['required', 'in:assign_form,send_notification'],
            'form_template_id' => ['required_if:action_type,assign_form', 'nullable', 'integer', 'exists:form_templates,id'],
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
            'notification_channels' => ['required_if:action_type,send_notification', 'nullable', 'array', 'min:1'],
            'notification_channels.*' => ['in:database,mail,webpush'],
            'notification_title' => ['required_if:action_type,send_notification', 'nullable', 'string', 'max:255'],
            'notification_body' => ['required_if:action_type,send_notification', 'nullable', 'string', 'max:2000'],
            'notification_url' => ['nullable', 'string', 'max:2048'],
            'is_required' => ['boolean'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);

        // No name given → generate one so the listing always reads well.
        if (blank($validated['name'] ?? null)) {
            $validated['name'] = $this->generateName($validated);
        }

        // Blank out whichever half doesn't apply so switching action type on
        // edit can't leave stale config behind.
        if ($validated['action_type'] === ModelTriggerAction::ACTION_ASSIGN_FORM) {
            $validated = array_merge($validated, [
                'notification_channels' => null,
                'notification_title' => null,
                'notification_body' => null,
                'notification_url' => null,
            ]);
        } else {
            $validated = array_merge($validated, [
                'form_template_id' => null,
                'subject_source' => null,
                'dispatch_mode' => 'auto',
                'min_submissions' => 1,
                'is_required' => false,
            ]);
        }

        return $validated;
    }

    /**
     * Short display name for the action: AI-written when the OpenAI key is
     * configured, otherwise (or on any failure) a deterministic description
     * built from the config. Never blocks a save.
     */
    private function generateName(array $config): string
    {
        return $this->aiName($config) ?? $this->fallbackName($config);
    }

    private function aiName(array $config): ?string
    {
        $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY');
        if (! $apiKey) {
            return null;
        }

        try {
            $response = Http::timeout(8)->withToken($apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4.1-mini',
                    'max_tokens' => 30,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You name workflow automations. Given a trigger/action config, reply with ONE short human-friendly name (3-8 words, plain text, no quotes, no trailing punctuation). Example: "Notify HR when application approved".',
                        ],
                        ['role' => 'user', 'content' => json_encode($this->nameContext($config))],
                    ],
                ]);

            $name = trim((string) $response->json('choices.0.message.content'), " \t\n\"'.");

            return ($name !== '' && mb_strlen($name) <= 120) ? $name : null;
        } catch (\Throwable $e) {
            Log::warning('Trigger action AI naming failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function fallbackName(array $config): string
    {
        $trigger = "{$this->modelLabelFor($config['model_type'])} · {$this->triggerLabelFor($config['trigger_key'])}";

        if ($config['action_type'] === ModelTriggerAction::ACTION_SEND_NOTIFICATION) {
            return "Notify — {$trigger}";
        }

        $template = FormTemplate::find($config['form_template_id'])?->name ?? 'form';

        return "Assign {$template} — {$trigger}";
    }

    /** The config facts worth telling the naming model about. */
    private function nameContext(array $config): array
    {
        return [
            'trigger_model' => $this->modelLabelFor($config['model_type']),
            'trigger' => $this->triggerLabelFor($config['trigger_key']),
            'action' => $config['action_type'] === ModelTriggerAction::ACTION_SEND_NOTIFICATION
                ? 'send a notification'
                : 'assign a form',
            'form_template' => isset($config['form_template_id'])
                ? FormTemplate::find($config['form_template_id'])?->name
                : null,
            'notification_title' => $config['notification_title'] ?? null,
            'recipient' => $config['assignee_strategy'] === 'permission'
                ? "everyone with permission {$config['assignee_value']}"
                : User::find($config['assignee_value'])?->name,
        ];
    }

    private function modelLabelFor(string $modelType): string
    {
        return collect($this->modelTypeOptions())->firstWhere('value', $modelType)['label'] ?? class_basename($modelType);
    }

    private function triggerLabelFor(string $triggerKey): string
    {
        return \Illuminate\Support\Str::of($triggerKey)->replace('_', ' ')->title()->toString();
    }

    private function modelTypeOptions(): array
    {
        return [
            ['value' => EmploymentApplication::class, 'label' => 'Employment Enquiry'],
            ['value' => Injury::class, 'label' => 'Injury Report'],
        ];
    }

    /**
     * Map of model class → trigger keys that can fire actions.
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

    /**
     * Map of model class → {{token}} → human label, shown in the builder so
     * admins know what they can interpolate into notification title/body/url.
     * Mirrors ModelTriggerActionService::renderPlaceholders().
     *
     * @return array<string, array<string, string>>
     */
    private function placeholdersByModel(): array
    {
        return collect($this->modelTypeOptions())
            ->mapWithKeys(function (array $option) {
                $class = $option['value'];

                $tokens = is_subclass_of($class, ProvidesFormPlaceholders::class)
                    ? $class::formPlaceholderDefinitions()
                    : [];

                return [$class => $tokens + [
                    'id' => 'Record ID',
                    'url' => 'Link to the record',
                ]];
            })
            ->all();
    }
}
