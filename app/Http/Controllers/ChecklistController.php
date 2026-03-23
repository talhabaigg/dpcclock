<?php

namespace App\Http\Controllers;

use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\ChecklistTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class ChecklistController extends Controller
{
    /**
     * Toggle a checklist item's completed state.
     */
    public function toggleItem(Request $request, ChecklistItem $checklistItem): RedirectResponse
    {
        if ($checklistItem->isCompleted()) {
            $checklistItem->update([
                'completed_at' => null,
                'completed_by' => null,
            ]);
        } else {
            $checklistItem->update([
                'completed_at' => now(),
                'completed_by' => $request->user()->id,
            ]);
        }

        return back();
    }

    /**
     * Update notes on a checklist item.
     */
    public function updateItemNotes(Request $request, ChecklistItem $checklistItem): RedirectResponse
    {
        $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $checklistItem->update(['notes' => $request->notes]);

        return back();
    }

    /**
     * Add an ad-hoc item to an existing checklist.
     */
    public function addItem(Request $request, Checklist $checklist): RedirectResponse
    {
        $request->validate([
            'label' => ['required', 'string', 'max:255'],
        ]);

        $checklist->items()->create([
            'label' => $request->label,
            'sort_order' => ($checklist->items()->max('sort_order') ?? 0) + 1,
            'is_required' => true,
        ]);

        return back();
    }

    /**
     * Delete a checklist item.
     */
    public function deleteItem(ChecklistItem $checklistItem): RedirectResponse
    {
        $checklistItem->delete();

        return back();
    }

    /**
     * Attach a template checklist to a checkable model.
     */
    public function attachTemplate(Request $request): RedirectResponse
    {
        $request->validate([
            'checkable_type' => ['required', 'string'],
            'checkable_id' => ['required', 'integer'],
            'checklist_template_id' => ['required', 'exists:checklist_templates,id'],
        ]);

        $modelMap = [
            'employment_application' => \App\Models\EmploymentApplication::class,
        ];

        $modelClass = $modelMap[$request->checkable_type] ?? null;
        if (! $modelClass) {
            return back()->withErrors(['checkable_type' => 'Invalid model type.']);
        }

        $model = $modelClass::findOrFail($request->checkable_id);
        $template = ChecklistTemplate::with('items')->findOrFail($request->checklist_template_id);

        $model->attachChecklist($template);

        return back();
    }

    /**
     * Create an ad-hoc checklist on a checkable model.
     */
    public function createAdHoc(Request $request): RedirectResponse
    {
        $request->validate([
            'checkable_type' => ['required', 'string'],
            'checkable_id' => ['required', 'integer'],
            'name' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.label' => ['required', 'string', 'max:255'],
        ]);

        $modelMap = [
            'employment_application' => \App\Models\EmploymentApplication::class,
        ];

        $modelClass = $modelMap[$request->checkable_type] ?? null;
        if (! $modelClass) {
            return back()->withErrors(['checkable_type' => 'Invalid model type.']);
        }

        $model = $modelClass::findOrFail($request->checkable_id);
        $checklist = $model->addAdHocChecklist($request->name ?? 'General');

        foreach ($request->items as $index => $itemData) {
            $checklist->items()->create([
                'label' => $itemData['label'],
                'sort_order' => $index + 1,
                'is_required' => true,
            ]);
        }

        return back();
    }

    /**
     * Delete an entire checklist.
     */
    public function destroyChecklist(Checklist $checklist): RedirectResponse
    {
        $checklist->delete();

        return back();
    }

    /**
     * Get activity history for a checklist item (JSON for dialog).
     */
    public function itemHistory(ChecklistItem $checklistItem): JsonResponse
    {
        $activities = Activity::where('subject_type', ChecklistItem::class)
            ->where('subject_id', $checklistItem->id)
            ->with('causer:id,name')
            ->latest()
            ->get()
            ->map(function ($activity) {
                $old = $activity->properties['old'] ?? [];
                $new = $activity->properties['attributes'] ?? [];

                return [
                    'id' => $activity->id,
                    'event' => $activity->description,
                    'user' => $activity->causer ? [
                        'id' => $activity->causer->id,
                        'name' => $activity->causer->name,
                    ] : null,
                    'old' => $old,
                    'new' => $new,
                    'created_at' => $activity->created_at->toISOString(),
                ];
            });

        return response()->json(['activities' => $activities]);
    }
}
