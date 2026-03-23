<?php

namespace App\Http\Controllers;

use App\Models\ChecklistTemplate;
use App\Models\ChecklistTemplateItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChecklistTemplateController extends Controller
{
    public function index(): Response
    {
        $templates = ChecklistTemplate::withCount('items')
            ->orderBy('name')
            ->get();

        return Inertia::render('checklist-templates/index', [
            'templates' => $templates,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('checklist-templates/form', [
            'template' => null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'model_type' => ['nullable', 'string'],
            'auto_attach' => ['boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.label' => ['required', 'string', 'max:255'],
            'items.*.is_required' => ['boolean'],
        ]);

        $template = ChecklistTemplate::create([
            'name' => $request->name,
            'model_type' => $this->resolveModelType($request->model_type),
            'auto_attach' => $request->boolean('auto_attach'),
            'is_active' => true,
        ]);

        foreach ($request->items as $index => $item) {
            $template->items()->create([
                'label' => $item['label'],
                'sort_order' => $index + 1,
                'is_required' => $item['is_required'] ?? true,
            ]);
        }

        return redirect()->route('checklist-templates.index')
            ->with('success', 'Template created.');
    }

    public function edit(ChecklistTemplate $checklistTemplate): Response
    {
        $checklistTemplate->load('items');

        return Inertia::render('checklist-templates/form', [
            'template' => $checklistTemplate,
        ]);
    }

    public function update(Request $request, ChecklistTemplate $checklistTemplate): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'model_type' => ['nullable', 'string'],
            'auto_attach' => ['boolean'],
            'is_active' => ['boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.label' => ['required', 'string', 'max:255'],
            'items.*.is_required' => ['boolean'],
        ]);

        $checklistTemplate->update([
            'name' => $request->name,
            'model_type' => $this->resolveModelType($request->model_type),
            'auto_attach' => $request->boolean('auto_attach'),
            'is_active' => $request->boolean('is_active'),
        ]);

        // Sync items: keep existing by id, create new, delete removed
        $incomingIds = collect($request->items)->pluck('id')->filter()->toArray();
        $checklistTemplate->items()->whereNotIn('id', $incomingIds)->delete();

        foreach ($request->items as $index => $itemData) {
            if (! empty($itemData['id'])) {
                ChecklistTemplateItem::where('id', $itemData['id'])
                    ->where('checklist_template_id', $checklistTemplate->id)
                    ->update([
                        'label' => $itemData['label'],
                        'sort_order' => $index + 1,
                        'is_required' => $itemData['is_required'] ?? true,
                    ]);
            } else {
                $checklistTemplate->items()->create([
                    'label' => $itemData['label'],
                    'sort_order' => $index + 1,
                    'is_required' => $itemData['is_required'] ?? true,
                ]);
            }
        }

        return redirect()->route('checklist-templates.index')
            ->with('success', 'Template updated.');
    }

    public function destroy(ChecklistTemplate $checklistTemplate): RedirectResponse
    {
        $checklistTemplate->delete();

        return redirect()->route('checklist-templates.index')
            ->with('success', 'Template deleted.');
    }

    private function resolveModelType(?string $type): ?string
    {
        $map = [
            'employment_application' => \App\Models\EmploymentApplication::class,
        ];

        return $map[$type] ?? $type;
    }
}
