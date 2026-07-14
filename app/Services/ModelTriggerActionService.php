<?php

namespace App\Services;

use App\Contracts\ProvidesFormPlaceholders;
use App\Models\FormRequest;
use App\Models\ModelTriggerAction;
use App\Models\User;
use App\Notifications\TriggerActionNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class ModelTriggerActionService
{
    public function __construct(
        private FormService $formService,
    ) {}

    /**
     * Reasons why a transition out of the current trigger key is blocked because
     * required forms haven't met the minimum submission count. Empty array = ok.
     * Only assign_form actions can block — notifications never gate anything.
     *
     * @return array<int, string>
     */
    public function blockersForLeaving(Model $formable, string $currentTriggerKey): array
    {
        $actions = $this->activeActionsFor($formable, $currentTriggerKey)
            ->filter(fn (ModelTriggerAction $action) => $action->isAssignForm())
            ->where('is_required', true);

        if ($actions->isEmpty()) {
            return [];
        }

        $blockers = [];

        foreach ($actions as $action) {
            $required = max(1, (int) $action->min_submissions);
            $submittedCount = FormRequest::query()
                ->where('formable_type', get_class($formable))
                ->where('formable_id', $formable->getKey())
                ->where('form_template_id', $action->form_template_id)
                ->where('status', 'submitted')
                ->count();

            if ($submittedCount < $required) {
                $blockers[] = $required > 1
                    ? "{$action->formTemplate->name}: {$submittedCount} of {$required} completed"
                    : $action->formTemplate->name;
            }
        }

        return $blockers;
    }

    /**
     * Fire all auto-mode actions configured for the given trigger key:
     * assign_form actions create FormRequests (idempotent — skips actions
     * whose (formable, template, subject) tuple already has a non-cancelled
     * FormRequest), send_notification actions notify their recipients
     * (fire-and-forget, re-fires on every hit of the trigger).
     *
     * On-demand form actions are skipped here — they're surfaced via
     * availableOnDemandForms() and created by startOnDemand() when HR clicks.
     *
     * @return array{forms: Collection<int, FormRequest>, notified: int}
     */
    public function dispatchActionsFor(Model $formable, string $triggerKey, User $admin): array
    {
        $createdForms = collect();
        $notified = 0;

        $actions = $this->activeActionsFor($formable, $triggerKey)
            ->where('dispatch_mode', 'auto');

        foreach ($actions as $action) {
            if (! $action->isAssignForm()) {
                $notified += $this->sendNotification($action, $formable, $admin);
                continue;
            }

            $subjects = $this->resolveSubjects($action, $formable);

            foreach ($subjects as $subject) {
                if ($this->formExists($formable, $action->form_template_id, $subject)) {
                    continue;
                }

                $formRequest = $this->createForAction($action, $formable, $subject, $admin);
                if ($formRequest) {
                    $createdForms->push($formRequest);
                }
            }
        }

        return ['forms' => $createdForms, 'notified' => $notified];
    }

    /**
     * Read-side: which on-demand form actions are configured for this
     * formable's current trigger key? The application show page uses this to
     * render per-subject "Start" buttons.
     *
     * @return Collection<int, ModelTriggerAction>
     */
    public function availableOnDemandForms(Model $formable, string $triggerKey): Collection
    {
        return $this->activeActionsFor($formable, $triggerKey)
            ->filter(fn (ModelTriggerAction $action) => $action->isAssignForm())
            ->where('dispatch_mode', 'on_demand');
    }

    /**
     * Create a FormRequest for one specific subject under an on-demand action.
     * Skips silently if a non-cancelled form already exists for the same
     * (formable, template, subject) tuple.
     */
    public function startOnDemand(
        ModelTriggerAction $action,
        Model $formable,
        ?Model $subject,
        User $admin,
    ): ?FormRequest {
        if ($this->formExists($formable, $action->form_template_id, $subject)) {
            return null;
        }

        return $this->createForAction($action, $formable, $subject, $admin);
    }

    /**
     * Sweep any pending forms tied to form actions on the given trigger key.
     * Called when the formable transitions out of the trigger stage so HR
     * doesn't see stranded "in progress" forms forever.
     */
    public function cancelPendingForTrigger(Model $formable, string $leftTriggerKey, User $admin): int
    {
        $templateIds = ModelTriggerAction::query()
            ->forModelTrigger(get_class($formable), $leftTriggerKey)
            ->where('action_type', ModelTriggerAction::ACTION_ASSIGN_FORM)
            ->pluck('form_template_id');

        if ($templateIds->isEmpty()) {
            return 0;
        }

        $cancelled = 0;
        FormRequest::query()
            ->where('formable_type', get_class($formable))
            ->where('formable_id', $formable->getKey())
            ->whereIn('form_template_id', $templateIds)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->each(function (FormRequest $fr) use ($admin, &$cancelled) {
                $this->formService->cancel($fr, $admin);
                $cancelled++;
            });

        return $cancelled;
    }

    /**
     * @return Collection<int, ModelTriggerAction>
     */
    private function activeActionsFor(Model $formable, string $triggerKey): Collection
    {
        return ModelTriggerAction::query()
            ->active()
            ->forModelTrigger(get_class($formable), $triggerKey)
            ->with('formTemplate')
            ->get();
    }

    /**
     * Notify everyone the action addresses, with placeholders in the
     * title/body/url rendered against the triggering model. Returns how many
     * users were notified.
     */
    private function sendNotification(ModelTriggerAction $action, Model $formable, User $admin): int
    {
        $recipients = $action->resolveRecipients();

        if ($recipients->isEmpty()) {
            if (method_exists($formable, 'addSystemComment')) {
                $formable->addSystemComment(
                    "Unable to send notification \"{$action->notification_title}\": no user matched recipient \"{$action->assignee_value}\"",
                    ['type' => 'trigger_action_recipient_missing', 'trigger_action_id' => $action->id],
                    $admin->id,
                );
            }

            return 0;
        }

        $title = $this->renderPlaceholders($action->notification_title, $formable);
        $body = $this->renderPlaceholders($action->notification_body, $formable);
        $url = $action->notification_url
            ? $this->renderPlaceholders($action->notification_url, $formable)
            : (method_exists($formable, 'formContextUrl') ? $formable->formContextUrl() : null);

        $notification = new TriggerActionNotification($title, $body, $url, $action->notification_channels ?? ['database']);

        foreach ($recipients as $recipient) {
            $recipient->notify($notification);
        }

        if (method_exists($formable, 'addSystemComment')) {
            $formable->addSystemComment(
                "Sent notification **{$title}** to {$recipients->count()} recipient(s)",
                ['type' => 'trigger_action_notification_sent', 'trigger_action_id' => $action->id],
                $admin->id,
            );
        }

        return $recipients->count();
    }

    /**
     * Substitute {{key}} tokens using the model's form placeholders (when it
     * provides them) plus the generic {{id}} and {{url}} tokens. Same token
     * syntax as DocumentTemplate::renderHtml() so admins learn it once.
     */
    private function renderPlaceholders(?string $text, Model $model): string
    {
        if (! $text) {
            return '';
        }

        $values = $model instanceof ProvidesFormPlaceholders ? $model->formPlaceholderValues() : [];
        $values['id'] = (string) $model->getKey();
        if (method_exists($model, 'formContextUrl')) {
            $values['url'] = $model->formContextUrl();
        }

        foreach ($values as $key => $value) {
            $text = str_replace('{{' . $key . '}}', (string) ($value ?? ''), $text);
        }

        return $text;
    }

    /**
     * Resolve the subject collection for a form action. Null subject_source
     * means one pass with no subject; a relation name means fan out over that
     * relation on the formable.
     *
     * @return Collection<int, Model|null>
     */
    private function resolveSubjects(ModelTriggerAction $action, Model $formable): Collection
    {
        if (! $action->subject_source) {
            return collect([null]);
        }

        $related = $formable->{$action->subject_source};

        if ($related instanceof Collection) {
            return $related;
        }

        return collect($related ? [$related] : []);
    }

    /**
     * Idempotency check: does a non-cancelled FormRequest already exist for
     * this (formable, template, subject) tuple? Subject is part of the key so
     * each reference gets its own form independently of the others.
     */
    private function formExists(Model $formable, int $templateId, ?Model $subject): bool
    {
        return FormRequest::query()
            ->where('formable_type', get_class($formable))
            ->where('formable_id', $formable->getKey())
            ->where('form_template_id', $templateId)
            ->when($subject,
                fn ($q) => $q
                    ->where('subject_type', get_class($subject))
                    ->where('subject_id', $subject->getKey()),
                fn ($q) => $q->whereNull('subject_id'),
            )
            ->whereIn('status', ['pending', 'sent', 'opened', 'submitted'])
            ->exists();
    }

    /**
     * Build & dispatch a single FormRequest for one form action + subject pair.
     * Shared by auto-mode dispatch and on-demand starts so the assignee /
     * delivery / comment logic lives in one place.
     */
    private function createForAction(
        ModelTriggerAction $action,
        Model $formable,
        ?Model $subject,
        User $admin,
    ): ?FormRequest {
        // Permission-based action = in-app, visible to anyone with the
        // permission. Doesn't pick a specific user, doesn't send email.
        if ($action->assignee_strategy === 'permission') {
            return $this->formService->createAndSend(
                template: $action->formTemplate,
                deliveryMethod: 'in_app',
                admin: $admin,
                recipientName: "Anyone with permission: {$action->assignee_value}",
                recipientEmail: null,
                formable: $formable,
                subject: $subject,
                assigneeStrategy: 'permission',
                assigneePermission: $action->assignee_value,
            );
        }

        // User-based action: resolve to the specific user.
        $assignee = $action->resolveAssignee();

        if (! $assignee) {
            if (method_exists($formable, 'addSystemComment')) {
                $formable->addSystemComment(
                    "Unable to dispatch \"{$action->formTemplate->name}\": no user matched assignee \"{$action->assignee_value}\"",
                    ['type' => 'trigger_form_assignee_missing', 'trigger_form_id' => $action->id],
                    $admin->id,
                );
            }
            return null;
        }

        // Non-sendable templates stay in-app even when a specific user is
        // assigned. Sendable templates email the assignee.
        $deliveryMethod = $action->formTemplate->is_sendable ? 'email' : 'in_app';

        return $this->formService->createAndSend(
            template: $action->formTemplate,
            deliveryMethod: $deliveryMethod,
            admin: $admin,
            recipientName: $assignee->name,
            recipientEmail: $deliveryMethod === 'email' ? $assignee->email : null,
            formable: $formable,
            subject: $subject,
            assigneeStrategy: 'user',
            assigneeUserId: $assignee->id,
        );
    }
}
