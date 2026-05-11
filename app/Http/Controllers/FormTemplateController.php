<?php

namespace App\Http\Controllers;

use App\Models\FormTemplate;
use App\Services\FormPlaceholderResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'category' => 'nullable|string|max:255',
            'model_type' => 'nullable|string',
            'is_active' => 'boolean',
            'fields' => 'required|array|min:1',
            'fields.*.label' => 'required|string|max:1000',
            'fields.*.type' => 'required|in:text,textarea,number,email,phone,date,select,radio,checkbox,heading,paragraph',
            'fields.*.is_required' => 'boolean',
            'fields.*.options' => 'nullable|array',
            'fields.*.placeholder' => 'nullable|string|max:255',
            'fields.*.help_text' => 'nullable|string|max:500',
            'fields.*.default_value' => 'nullable|string|max:1000',
        ]);

        $this->validatePlaceholderTokens($validated, app(FormPlaceholderResolver::class));

        // Continue with creation
        $template = FormTemplate::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'model_type' => $this->resolveModelType($validated['model_type'] ?? null),
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()->id,
        ]);

        foreach ($validated['fields'] as $index => $field) {
            $template->fields()->create([
                'label' => $field['label'],
                'type' => $field['type'],
                'sort_order' => $index,
                'is_required' => $field['is_required'] ?? false,
                'options' => $field['options'] ?? null,
                'placeholder' => $field['placeholder'] ?? null,
                'help_text' => $field['help_text'] ?? null,
                'default_value' => $field['default_value'] ?? null,
            ]);
        }

        return redirect()->route('form-templates.index')->with('success', 'Form template created.');
    }

    public function edit(FormTemplate $formTemplate)
    {
        $formTemplate->load('fields');

        return Inertia::render('form-templates/form', [
            'template' => $formTemplate,
        ]);
    }

    public function update(Request $request, FormTemplate $formTemplate)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'category' => 'nullable|string|max:255',
            'model_type' => 'nullable|string',
            'is_active' => 'boolean',
            'fields' => 'required|array|min:1',
            'fields.*.id' => 'nullable|integer',
            'fields.*.label' => 'required|string|max:1000',
            'fields.*.type' => 'required|in:text,textarea,number,email,phone,date,select,radio,checkbox,heading,paragraph',
            'fields.*.is_required' => 'boolean',
            'fields.*.options' => 'nullable|array',
            'fields.*.placeholder' => 'nullable|string|max:255',
            'fields.*.help_text' => 'nullable|string|max:500',
            'fields.*.default_value' => 'nullable|string|max:1000',
        ]);

        $this->validatePlaceholderTokens($validated, app(FormPlaceholderResolver::class));

        $formTemplate->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'model_type' => $this->resolveModelType($validated['model_type'] ?? null),
            'is_active' => $validated['is_active'] ?? true,
            'updated_by' => $request->user()->id,
        ]);

        // Sync fields: delete removed, update existing, create new
        $existingIds = collect($validated['fields'])->pluck('id')->filter()->toArray();
        $formTemplate->fields()->whereNotIn('id', $existingIds)->delete();

        foreach ($validated['fields'] as $index => $field) {
            if (! empty($field['id'])) {
                $formTemplate->fields()->where('id', $field['id'])->update([
                    'label' => $field['label'],
                    'type' => $field['type'],
                    'sort_order' => $index,
                    'is_required' => $field['is_required'] ?? false,
                    'options' => $field['options'] ?? null,
                    'placeholder' => $field['placeholder'] ?? null,
                    'help_text' => $field['help_text'] ?? null,
                    'default_value' => $field['default_value'] ?? null,
                ]);
            } else {
                $formTemplate->fields()->create([
                    'label' => $field['label'],
                    'type' => $field['type'],
                    'sort_order' => $index,
                    'is_required' => $field['is_required'] ?? false,
                    'options' => $field['options'] ?? null,
                    'placeholder' => $field['placeholder'] ?? null,
                    'help_text' => $field['help_text'] ?? null,
                    'default_value' => $field['default_value'] ?? null,
                ]);
            }
        }

        return redirect()->route('form-templates.index')->with('success', 'Form template updated.');
    }

    public function destroy(FormTemplate $formTemplate)
    {
        $formTemplate->delete();

        return redirect()->route('form-templates.index')->with('success', 'Form template deleted.');
    }

    private function resolveModelType(?string $value): ?string
    {
        return match ($value) {
            'employment_application' => \App\Models\EmploymentApplication::class,
            \App\Models\EmploymentApplication::class => \App\Models\EmploymentApplication::class,
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
}
