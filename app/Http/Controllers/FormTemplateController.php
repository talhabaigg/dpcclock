<?php

namespace App\Http\Controllers;

use App\Models\FormTemplate;
use App\Services\FormPlaceholderResolver;
use App\Services\FormResolverRegistry;
use App\Services\FormVisibilityEvaluator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;

class FormTemplateController extends Controller
{
    public function index()
    {
        $templates = FormTemplate::withCount('fields')
            ->latest()
            ->get();

        return Inertia::render('form-templates/index', [
            'templates' => $templates,
        ]);
    }

    public function create()
    {
        return Inertia::render('form-templates/form', [
            'template' => null,
            'permissions' => Permission::orderBy('name')->pluck('name'),
        ]);
    }

    /**
     * Return the available placeholder tokens for a given model_type. Used by
     * the form-builder token picker.
     */
    public function placeholders(Request $request, FormPlaceholderResolver $resolver): JsonResponse
    {
        $request->validate([
            'model_type' => 'nullable|string',
        ]);

        $modelClass = $this->resolveModelType($request->input('model_type'));

        $definitions = $resolver->definitionsFor($modelClass);
        $samples = $resolver->samplesFor($modelClass);

        $tokens = [];
        foreach ($definitions as $token => $label) {
            $tokens[] = [
                'token' => $token,
                'label' => $label,
                'sample' => $samples[$token] ?? '',
                'group' => $this->tokenGroup($token),
            ];
        }

        return response()->json(['tokens' => $tokens]);
    }

    private function tokenGroup(string $token): string
    {
        $prefix = explode('.', $token)[0] ?? 'other';

        return match ($prefix) {
            'applicant' => 'Applicant',
            'application' => 'Application',
            'current_user' => 'Form filler',
            'today', 'now' => 'Date & time',
            default => 'Other',
        };
    }

    /**
     * List the available dynamic options sources (Users, Employees, ...).
     */
    public function optionsSources(FormResolverRegistry $registry): JsonResponse
    {
        return response()->json(['sources' => $registry->list()]);
    }

    /**
     * Resolve a single source key into its current {id, name} options. Used by
     * both the builder (for preview) and the public form renderer.
     */
    public function resolveOptionsSource(string $source, FormResolverRegistry $registry): JsonResponse
    {
        if (! $registry->has($source)) {
            return response()->json(['options' => []], 404);
        }

        return response()->json(['options' => $registry->resolve($source)]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate($this->fieldValidationRules());

        $this->validatePlaceholderTokens($validated, app(FormPlaceholderResolver::class));
        $this->validateVisibilityRules($validated);
        $this->validateOptionsSources($validated, app(FormResolverRegistry::class));

        $filledBy = $validated['filled_by'] ?? FormTemplate::FILLED_BY_SUBJECT;
        $template = FormTemplate::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'model_type' => $this->resolveModelType($validated['model_type'] ?? null),
            'filled_by' => $filledBy,
            'assignee_permission' => $filledBy === FormTemplate::FILLED_BY_USER
                ? ($validated['assignee_permission'] ?? null)
                : null,
            'is_active' => $validated['is_active'] ?? true,
            'is_sendable' => $validated['is_sendable'] ?? true,
            'created_by' => $request->user()->id,
        ]);

        // Pass 1: create fields without visible_if so every field has an id.
        $createdIds = [];
        foreach ($validated['fields'] as $index => $field) {
            $created = $template->fields()->create([
                'label' => $field['label'],
                'type' => $field['type'],
                'sort_order' => $index,
                'is_required' => $field['is_required'] ?? false,
                'options' => $this->normaliseOptions($field),
                'options_source' => $field['options_source'] ?? null,
                'placeholder' => $field['placeholder'] ?? null,
                'help_text' => $field['help_text'] ?? null,
                'default_value' => $field['default_value'] ?? null,
            ]);
            $createdIds[$index] = $created->id;
        }

        // Pass 2: resolve source_index → field_id and persist visible_if.
        $this->applyVisibilityRules($template, $validated['fields'], $createdIds);

        return redirect()->route('form-templates.index')->with('success', 'Form template created.');
    }

    public function edit(FormTemplate $formTemplate)
    {
        $formTemplate->load('fields');

        return Inertia::render('form-templates/form', [
            'template' => $this->serializeTemplateForBuilder($formTemplate),
            'permissions' => Permission::orderBy('name')->pluck('name'),
        ]);
    }

    public function update(Request $request, FormTemplate $formTemplate)
    {
        $validated = $request->validate($this->fieldValidationRules(includeFieldId: true));

        $this->validatePlaceholderTokens($validated, app(FormPlaceholderResolver::class));
        $this->validateVisibilityRules($validated);
        $this->validateOptionsSources($validated, app(FormResolverRegistry::class));

        $filledBy = $validated['filled_by'] ?? FormTemplate::FILLED_BY_SUBJECT;
        $formTemplate->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'model_type' => $this->resolveModelType($validated['model_type'] ?? null),
            'filled_by' => $filledBy,
            'assignee_permission' => $filledBy === FormTemplate::FILLED_BY_USER
                ? ($validated['assignee_permission'] ?? null)
                : null,
            'is_active' => $validated['is_active'] ?? true,
            'is_sendable' => $validated['is_sendable'] ?? true,
            'updated_by' => $request->user()->id,
        ]);

        // Sync fields: delete removed, update existing, create new — clear
        // visible_if on every field first so pass-2 can rewrite it cleanly.
        $existingIds = collect($validated['fields'])->pluck('id')->filter()->toArray();
        $formTemplate->fields()->whereNotIn('id', $existingIds)->delete();

        $persistedIds = [];
        foreach ($validated['fields'] as $index => $field) {
            $payload = [
                'label' => $field['label'],
                'type' => $field['type'],
                'sort_order' => $index,
                'is_required' => $field['is_required'] ?? false,
                'options' => $this->normaliseOptions($field),
                'options_source' => $field['options_source'] ?? null,
                'placeholder' => $field['placeholder'] ?? null,
                'help_text' => $field['help_text'] ?? null,
                'default_value' => $field['default_value'] ?? null,
                'visible_if' => null,
            ];

            if (! empty($field['id'])) {
                $formTemplate->fields()->where('id', $field['id'])->update($payload);
                $persistedIds[$index] = (int) $field['id'];
            } else {
                $created = $formTemplate->fields()->create($payload);
                $persistedIds[$index] = $created->id;
            }
        }

        $this->applyVisibilityRules($formTemplate, $validated['fields'], $persistedIds);

        return redirect()->route('form-templates.index')->with('success', 'Form template updated.');
    }

    public function destroy(FormTemplate $formTemplate)
    {
        $formTemplate->delete();

        return redirect()->route('form-templates.index')->with('success', 'Form template deleted.');
    }

    public function export(FormTemplate $formTemplate)
    {
        $formTemplate->load('fields');

        $orderedFields = $formTemplate->fields->sortBy('sort_order')->values();
        $idToIndex = $orderedFields->mapWithKeys(fn ($f, $i) => [$f->id => $i])->all();

        $data = [
            'name' => $formTemplate->name,
            'description' => $formTemplate->description,
            'category' => $formTemplate->category,
            'model_type' => $formTemplate->model_type,
            'filled_by' => $formTemplate->filled_by,
            'assignee_permission' => $formTemplate->assignee_permission,
            'is_active' => $formTemplate->is_active,
            'is_sendable' => $formTemplate->is_sendable,
            'fields' => $orderedFields->map(fn ($f) => [
                'label' => $f->label,
                'type' => $f->type,
                'sort_order' => $f->sort_order,
                'is_required' => $f->is_required,
                'options' => $f->options,
                'options_source' => $f->options_source,
                'placeholder' => $f->placeholder,
                'help_text' => $f->help_text,
                'default_value' => $f->default_value,
                'visible_if' => $this->visibleIfToWire($f->visible_if, $idToIndex),
            ])->all(),
        ];

        $filename = str()->slug($formTemplate->name) . '-form-template.json';

        return response()->json($data, 200, [
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:json,txt',
        ]);

        $data = json_decode($request->file('file')->get(), true);

        if (! is_array($data) || ! isset($data['name'], $data['fields']) || ! is_array($data['fields']) || count($data['fields']) === 0) {
            return back()->with('error', 'Invalid form template file.');
        }

        $importedFilledBy = in_array($data['filled_by'] ?? null, [FormTemplate::FILLED_BY_USER, FormTemplate::FILLED_BY_SUBJECT], true)
            ? $data['filled_by']
            : FormTemplate::FILLED_BY_SUBJECT;
        $template = FormTemplate::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'category' => $data['category'] ?? null,
            'model_type' => $this->resolveModelType($data['model_type'] ?? null),
            'filled_by' => $importedFilledBy,
            'assignee_permission' => $importedFilledBy === FormTemplate::FILLED_BY_USER
                ? ($data['assignee_permission'] ?? null)
                : null,
            'is_active' => $data['is_active'] ?? true,
            'is_sendable' => $data['is_sendable'] ?? true,
            'created_by' => $request->user()->id,
        ]);

        $registry = app(FormResolverRegistry::class);
        $createdIds = [];
        $importedFields = array_values($data['fields']);
        foreach ($importedFields as $index => $field) {
            $source = $field['options_source'] ?? null;
            $created = $template->fields()->create([
                'label' => $field['label'] ?? 'Untitled',
                'type' => $field['type'] ?? 'text',
                'sort_order' => $index,
                'is_required' => $field['is_required'] ?? false,
                'options' => $source ? null : ($field['options'] ?? null),
                'options_source' => $source && $registry->has($source) ? $source : null,
                'placeholder' => $field['placeholder'] ?? null,
                'help_text' => $field['help_text'] ?? null,
                'default_value' => $field['default_value'] ?? null,
            ]);
            $createdIds[$index] = $created->id;
        }

        $this->applyVisibilityRules($template, $importedFields, $createdIds);

        return redirect()->route('form-templates.edit', $template)
            ->with('success', 'Form template imported.');
    }

    private function resolveModelType(?string $value): ?string
    {
        return match ($value) {
            'employment_application' => \App\Models\EmploymentApplication::class,
            \App\Models\EmploymentApplication::class => \App\Models\EmploymentApplication::class,
            'injury' => \App\Models\Injury::class,
            \App\Models\Injury::class => \App\Models\Injury::class,
            'employee' => \App\Models\Employee::class,
            \App\Models\Employee::class => \App\Models\Employee::class,
            default => null,
        };
    }

    /**
     * Reject the save if any placeholder token in default_value / label /
     * placeholder isn't registered for the template's model_type.
     */
    private function validatePlaceholderTokens(array $validated, FormPlaceholderResolver $resolver): void
    {
        $modelClass = $this->resolveModelType($validated['model_type'] ?? null);
        $available = array_keys($resolver->definitionsFor($modelClass));

        $unknown = [];
        foreach ($validated['fields'] ?? [] as $i => $field) {
            foreach (['label', 'placeholder', 'default_value'] as $attr) {
                $value = $field[$attr] ?? null;
                foreach ($resolver->extractTokens($value) as $token) {
                    if (! in_array($token, $available, true)) {
                        $unknown["fields.{$i}.{$attr}"] = "Unknown placeholder token: {{ {$token} }}";
                    }
                }
            }
        }

        if (! empty($unknown)) {
            throw \Illuminate\Validation\ValidationException::withMessages($unknown);
        }
    }

    /**
     * Shared validation rules. update() additionally allows fields.*.id.
     */
    private function fieldValidationRules(bool $includeFieldId = false): array
    {
        $rules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'category' => 'nullable|string|max:255',
            'model_type' => 'nullable|string',
            'filled_by' => 'required|in:user,subject',
            'assignee_permission' => 'nullable|string|max:255|required_if:filled_by,user|exists:permissions,name',
            'is_active' => 'boolean',
            'is_sendable' => 'boolean',
            'fields' => 'required|array|min:1',
            'fields.*.label' => 'required|string|max:1000',
            'fields.*.type' => 'required|in:text,textarea,number,email,phone,date,select,radio,checkbox,multiselect,button_group,button_group_multi,heading,paragraph,signature,page_break',
            'fields.*.is_required' => 'boolean',
            'fields.*.options' => 'nullable|array',
            'fields.*.options_source' => 'nullable|string|max:64',
            'fields.*.placeholder' => 'nullable|string|max:255',
            'fields.*.help_text' => 'nullable|string|max:500',
            'fields.*.default_value' => 'nullable|string|max:1000',
            'fields.*.visible_if' => 'nullable|array',
            'fields.*.visible_if.source_index' => 'required_with:fields.*.visible_if|integer|min:0',
            'fields.*.visible_if.operator' => 'required_with:fields.*.visible_if|in:'.implode(',', FormVisibilityEvaluator::OPERATORS),
            'fields.*.visible_if.value' => 'nullable|string|max:255',
        ];

        if ($includeFieldId) {
            $rules['fields.*.id'] = 'nullable|integer';
        }

        return $rules;
    }

    /**
     * Reject visible_if rules that point forward, at self, at non-existent
     * indexes, at fields whose type can't act as a source, or whose value isn't
     * one of the source's options. Mirrors the constraint surfaced in the UI.
     */
    private function validateVisibilityRules(array $validated): void
    {
        $fields = $validated['fields'] ?? [];
        $errors = [];

        foreach ($fields as $i => $field) {
            $rule = $field['visible_if'] ?? null;
            if (! is_array($rule)) {
                continue;
            }

            $sourceIndex = $rule['source_index'] ?? null;
            $operator = $rule['operator'] ?? null;
            $value = $rule['value'] ?? null;
            $key = "fields.{$i}.visible_if";

            if (! is_int($sourceIndex) || $sourceIndex < 0 || $sourceIndex >= count($fields)) {
                $errors["{$key}.source_index"] = 'Source field is missing.';
                continue;
            }
            if ($sourceIndex >= $i) {
                $errors["{$key}.source_index"] = 'A field can only depend on a field that appears earlier in the form.';
                continue;
            }

            $sourceField = $fields[$sourceIndex];
            if (! in_array($sourceField['type'] ?? null, ['radio', 'select', 'checkbox', 'multiselect', 'button_group', 'button_group_multi'], true)) {
                $errors["{$key}.source_index"] = 'Source field must be a choice-style question.';
                continue;
            }

            if (in_array($operator, ['equals', 'not_equals'], true)) {
                if ($value === null || $value === '') {
                    $errors["{$key}.value"] = 'Pick a value for the rule.';
                    continue;
                }
                $options = $sourceField['options'] ?? [];
                if (is_array($options) && count($options) > 0 && ! in_array($value, $options, true)) {
                    $errors["{$key}.value"] = 'Value must match one of the source field options.';
                }
            }
        }

        if (! empty($errors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($errors);
        }
    }

    /**
     * Pass 2 of save: now that every field has an id, resolve each rule's
     * source_index to a field_id and persist the visible_if blob.
     *
     * @param  array<int,int>  $indexToId
     */
    private function applyVisibilityRules(FormTemplate $template, array $fields, array $indexToId): void
    {
        foreach ($fields as $index => $field) {
            $rule = $field['visible_if'] ?? null;
            if (! is_array($rule)) {
                continue;
            }

            $sourceId = $indexToId[$rule['source_index']] ?? null;
            if ($sourceId === null) {
                continue;
            }

            $fieldId = $indexToId[$index] ?? null;
            if ($fieldId === null) {
                continue;
            }

            $template->fields()->where('id', $fieldId)->update([
                'visible_if' => [
                    'field_id' => $sourceId,
                    'operator' => $rule['operator'],
                    'value' => in_array($rule['operator'], ['empty', 'not_empty'], true) ? null : ($rule['value'] ?? null),
                ],
            ]);
        }
    }

    /**
     * Convert the DB-shaped visible_if (field_id) to the wire shape (source_index)
     * for the React builder and the JSON export.
     *
     * @param  array<int,int>  $idToIndex
     */
    private function visibleIfToWire(?array $rule, array $idToIndex): ?array
    {
        if (! is_array($rule) || empty($rule['field_id']) || empty($rule['operator'])) {
            return null;
        }

        $sourceIndex = $idToIndex[(int) $rule['field_id']] ?? null;
        if ($sourceIndex === null) {
            return null;
        }

        return [
            'source_index' => $sourceIndex,
            'operator' => $rule['operator'],
            'value' => $rule['value'] ?? null,
        ];
    }

    /**
     * Shape the template payload for the React builder: convert each field's
     * visible_if from {field_id} to {source_index}.
     */
    private function serializeTemplateForBuilder(FormTemplate $formTemplate): array
    {
        $orderedFields = $formTemplate->fields->sortBy('sort_order')->values();
        $idToIndex = $orderedFields->mapWithKeys(fn ($f, $i) => [$f->id => $i])->all();

        return [
            'id' => $formTemplate->id,
            'name' => $formTemplate->name,
            'description' => $formTemplate->description,
            'category' => $formTemplate->category,
            'model_type' => $formTemplate->model_type,
            'filled_by' => $formTemplate->filled_by,
            'assignee_permission' => $formTemplate->assignee_permission,
            'is_active' => $formTemplate->is_active,
            'is_sendable' => $formTemplate->is_sendable,
            'fields' => $orderedFields->map(fn ($f) => [
                'id' => $f->id,
                'label' => $f->label,
                'type' => $f->type,
                'sort_order' => $f->sort_order,
                'is_required' => $f->is_required,
                'options' => $f->options,
                'options_source' => $f->options_source,
                'placeholder' => $f->placeholder,
                'help_text' => $f->help_text,
                'default_value' => $f->default_value,
                'visible_if' => $this->visibleIfToWire($f->visible_if, $idToIndex),
            ])->all(),
        ];
    }

    /**
     * A field with options_source set has its options resolved at render time;
     * inline options are ignored. Persisting NULL keeps the data clean.
     */
    private function normaliseOptions(array $field): ?array
    {
        if (! empty($field['options_source'])) {
            return null;
        }

        return $field['options'] ?? null;
    }

    /**
     * Reject any options_source that isn't in the allowlist registry. Without
     * this guard an admin could persist an arbitrary string that the renderer
     * later tries to fetch.
     */
    private function validateOptionsSources(array $validated, FormResolverRegistry $registry): void
    {
        $errors = [];
        foreach ($validated['fields'] ?? [] as $i => $field) {
            $source = $field['options_source'] ?? null;
            if ($source === null || $source === '') {
                continue;
            }
            if (! in_array($field['type'] ?? '', ['select', 'radio', 'checkbox', 'multiselect', 'button_group', 'button_group_multi'], true)) {
                $errors["fields.{$i}.options_source"] = 'Dynamic options only apply to choice-style questions.';
                continue;
            }
            if (! $registry->has($source)) {
                $errors["fields.{$i}.options_source"] = "Unknown options source: {$source}";
            }
        }

        if (! empty($errors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($errors);
        }
    }
}
