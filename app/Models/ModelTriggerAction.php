<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One configured action fired when a watched model hits a trigger key
 * (e.g. an EmploymentApplication status, or 'created' on an Injury).
 *
 * action_type decides what fires:
 *  - assign_form: create a FormRequest from form_template_id (the original
 *    trigger-forms behavior — dispatch_mode, min_submissions, is_required
 *    and subject_source only apply here)
 *  - send_notification: notify the resolved recipients using the
 *    notification_* columns (title/body/url support {{placeholder}} tokens)
 */
class ModelTriggerAction extends Model
{
    public const ACTION_ASSIGN_FORM = 'assign_form';

    public const ACTION_SEND_NOTIFICATION = 'send_notification';

    protected $fillable = [
        'model_type',
        'trigger_key',
        'action_type',
        'form_template_id',
        'subject_source',
        'dispatch_mode',
        'min_submissions',
        'assignee_strategy',
        'assignee_value',
        'notification_channels',
        'notification_title',
        'notification_body',
        'notification_url',
        'is_required',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active' => 'boolean',
            'min_submissions' => 'integer',
            'notification_channels' => 'array',
        ];
    }

    public function formTemplate(): BelongsTo
    {
        return $this->belongsTo(FormTemplate::class);
    }

    public function isAssignForm(): bool
    {
        return $this->action_type === self::ACTION_ASSIGN_FORM;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForModelTrigger(Builder $query, string $modelClass, string $triggerKey): Builder
    {
        return $query->where('model_type', $modelClass)
            ->where('trigger_key', $triggerKey)
            ->orderBy('sort_order');
    }

    public function resolveAssignee(): ?User
    {
        return match ($this->assignee_strategy) {
            'role' => User::role($this->assignee_value)->first(),
            'user' => User::find($this->assignee_value),
            default => null,
        };
    }

    /**
     * Everyone the action addresses — a single user, or all users holding the
     * configured permission (directly or via a role). send_notification fans
     * out over this; assign_form keeps resolveAssignee().
     *
     * @return Collection<int, User>
     */
    public function resolveRecipients(): Collection
    {
        return match ($this->assignee_strategy) {
            'permission' => User::permission($this->assignee_value)->get(),
            'user' => User::whereKey($this->assignee_value)->get(),
            default => new Collection,
        };
    }
}
