<?php

namespace App\Http\Controllers;

use App\Models\FormTemplate;
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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'category' => 'nullable|string|max:255',
            'model_type' => 'nullable|string',
            'is_active' => 'boolean',
            'fields' => 'required|array|min:1',
            'fields.*.label' => 'required|string|max:255',
            'fields.*.type' => 'required|in:text,textarea,number,email,phone,date,select,radio,checkbox,heading,paragraph',
            'fields.*.is_required' => 'boolean',
            'fields.*.options' => 'nullable|array',
            'fields.*.placeholder' => 'nullable|string|max:255',
            'fields.*.help_text' => 'nullable|string|max:500',
        ]);

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
            'fields.*.label' => 'required|string|max:255',
            'fields.*.type' => 'required|in:text,textarea,number,email,phone,date,select,radio,checkbox,heading,paragraph',
            'fields.*.is_required' => 'boolean',
            'fields.*.options' => 'nullable|array',
            'fields.*.placeholder' => 'nullable|string|max:255',
            'fields.*.help_text' => 'nullable|string|max:500',
        ]);

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
            default => null,
        };
    }
}
