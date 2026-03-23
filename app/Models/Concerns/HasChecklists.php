<?php

namespace App\Models\Concerns;

use App\Models\Checklist;
use App\Models\ChecklistTemplate;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait HasChecklists
{
    public static function bootHasChecklists(): void
    {
        static::created(function ($model) {
            $model->attachAutoChecklists();
        });
    }

    public function checklists(): MorphMany
    {
        return $this->morphMany(Checklist::class, 'checkable')->orderBy('sort_order');
    }

    /**
     * Attach all auto-attach templates for this model type.
     */
    public function attachAutoChecklists(): void
    {
        // Skip templates already attached to this record
        $attachedTemplateIds = $this->checklists()->pluck('checklist_template_id')->filter()->toArray();

        $templates = ChecklistTemplate::active()
            ->autoAttach()
            ->forModel(static::class)
            ->whereNotIn('id', $attachedTemplateIds)
            ->with('items')
            ->get();

        foreach ($templates as $template) {
            $this->attachChecklist($template);
        }
    }

    /**
     * Create a checklist instance from a template.
     */
    public function attachChecklist(ChecklistTemplate $template, ?int $sortOrder = null): Checklist
    {
        $checklist = $this->checklists()->create([
            'checklist_template_id' => $template->id,
            'name' => $template->name,
            'sort_order' => $sortOrder ?? ($this->checklists()->max('sort_order') ?? 0) + 1,
        ]);

        foreach ($template->items as $templateItem) {
            $checklist->items()->create([
                'label' => $templateItem->label,
                'sort_order' => $templateItem->sort_order,
                'is_required' => $templateItem->is_required,
            ]);
        }

        return $checklist;
    }

    /**
     * Create an ad-hoc checklist (no template).
     */
    public function addAdHocChecklist(string $name = 'General'): Checklist
    {
        return $this->checklists()->create([
            'checklist_template_id' => null,
            'name' => $name,
            'sort_order' => ($this->checklists()->max('sort_order') ?? 0) + 1,
        ]);
    }

    /**
     * Check if all required checklist items across all checklists are completed.
     */
    public function allRequiredChecklistItemsComplete(): bool
    {
        return ! $this->checklists()
            ->whereHas('items', function ($q) {
                $q->where('is_required', true)->whereNull('completed_at');
            })
            ->exists();
    }

    /**
     * Get count of incomplete required items.
     */
    public function incompleteRequiredChecklistItemsCount(): int
    {
        return Checklist::where('checkable_type', static::class)
            ->where('checkable_id', $this->id)
            ->join('checklist_items', 'checklists.id', '=', 'checklist_items.checklist_id')
            ->where('checklist_items.is_required', true)
            ->whereNull('checklist_items.completed_at')
            ->count();
    }
}
