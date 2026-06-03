<?php

namespace App\Services;

use App\Models\FormRequest;
use App\Models\ModelTriggerForm;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class ModelTriggerFormService
{
    public function __construct(
        private FormService $formService,
    ) {}

    /**
     * Reasons why a transition out of the current trigger key is blocked because
     * required forms haven't met the minimum submission count. Empty array = ok.
     *
     * @return array<int, string>
     */
    public function blockersForLeaving(Model $formable, string $currentTriggerKey): array
    {
        $mappings = $this->activeMappingsFor($formable, $currentTriggerKey)
            ->where('is_required', true);

        if ($mappings->isEmpty()) {
            return [];
        }

        $blockers = [];

        foreach ($mappings as $mapping) {
            $required = max(1, (int) $mapping->min_submissions);
            $submittedCount = FormRequest::query()
                ->where('formable_type', get_class($formable))
                ->where('formable_id', $formable->getKey())
                ->where('form_template_id', $mapping->form_template_id)
                ->where('status', 'submitted')
                ->count();

            if ($submittedCount < $required) {
                $blockers[] = $required > 1
                    ? "{$mapping->formTemplate->name}: {$submittedCount} of {$required} completed"
                    : $mapping->formTemplate->name;
            }
        }

        return $blockers;
    }

    /**
     * Dispatch all auto-mode forms configured for the given trigger key.
     * On-demand mappings are skipped here — they're surfaced via
     * availableOnDemandForms() and created by startOnDemand() when HR clicks.
     * Idempotent: skips mappings whose (formable, template, subject) tuple
     * already has a non-cancelled FormRequest.
     *
     * @return Collection<int, FormRequest>
     */
    public function dispatchFormsFor(Model $formable, string $triggerKey, User $admin): Collection
    {
        $created = collect();

        $mappings = $this->activeMappingsFor($formable, $triggerKey)
            ->where('dispatch_mode', 'auto');

        foreach ($mappings as $mapping) {
            $subjects = $this->resolveSubjects($mapping, $formable);

            foreach ($subjects as $subject) {
                if ($this->formExists($formable, $mapping->form_template_id, $subject)) {
                    continue;
                }

                $formRequest = $this->createForMapping($mapping, $formable, $subject, $admin);
                if ($formRequest) {
                    $created->push($formRequest);
                }
            }
        }

        return $created;
    }

    /**
     * Read-side: which on-demand mappings are configured for this formable's
     * current trigger key? The application show page uses this to render
     * per-subject "Start" buttons.
     *
     * @return Collection<int, ModelTriggerForm>
     */
    public function availableOnDemandForms(Model $formable, string $triggerKey): Collection
    {
        return $this->activeMappingsFor($formable, $triggerKey)
            ->where('dispatch_mode', 'on_demand');
    }

    /**
     * Create a FormRequest for one specific subject under an on-demand mapping.
     * Skips silently if a non-cancelled form already exists for the same
     * (formable, template, subject) tuple.
     */
    public function startOnDemand(
        ModelTriggerForm $mapping,
        Model $formable,
        ?Model $subject,
        User $admin,
    ): ?FormRequest {
        if ($this->formExists($formable, $mapping->form_template_id, $subject)) {
            return null;
        }

        return $this->createForMapping($mapping, $formable, $subject, $admin);
    }

    /**
     * Sweep any pending forms tied to mappings on the given trigger key.
     * Called when the formable transitions out of the trigger stage so HR
     * doesn't see stranded "in progress" forms forever.
     */
    public function cancelPendingForTrigger(Model $formable, string $leftTriggerKey, User $admin): int
    {
        $templateIds = ModelTriggerForm::query()
            ->forModelTrigger(get_class($formable), $leftTriggerKey)
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
     * @return Collection<int, ModelTriggerForm>
     */
    private function activeMappingsFor(Model $formable, string $triggerKey): Collection
    {
        return ModelTriggerForm::query()
            ->active()
            ->forModelTrigger(get_class($formable), $triggerKey)
            ->with('formTemplate')
            ->get();
    }

    /**
     * Resolve the subject collection for a mapping. Null subject_source means
     * one pass with no subject; a relation name means fan out over that
     * relation on the formable.
     *
     * @return Collection<int, Model|null>
     */
    private function resolveSubjects(ModelTriggerForm $mapping, Model $formable): Collection
    {
        if (! $mapping->subject_source) {
            return collect([null]);
        }

        $related = $formable->{$mapping->subject_source};

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
     * Build & dispatch a single FormRequest for one mapping + subject pair.
     * Shared by auto-mode dispatch and on-demand starts so the assignee /
     * delivery / comment logic lives in one place.
     */
    private function createForMapping(
        ModelTriggerForm $mapping,
        Model $formable,
        ?Model $subject,
        User $admin,
    ): ?FormRequest {
        // Permission-based mapping = in-app, visible to anyone with the
        // permission. Doesn't pick a specific user, doesn't send email.
        if ($mapping->assignee_strategy === 'permission') {
            return $this->formService->createAndSend(
                template: $mapping->formTemplate,
                deliveryMethod: 'in_app',
                admin: $admin,
                recipientName: "Anyone with permission: {$mapping->assignee_value}",
                recipientEmail: null,
                formable: $formable,
                subject: $subject,
                assigneeStrategy: 'permission',
                assigneePermission: $mapping->assignee_value,
            );
        }

        // User-based mapping: resolve to the specific user.
        $assignee = $mapping->resolveAssignee();

        if (! $assignee) {
            if (method_exists($formable, 'addSystemComment')) {
                $formable->addSystemComment(
                    "Unable to dispatch \"{$mapping->formTemplate->name}\": no user matched assignee \"{$mapping->assignee_value}\"",
                    ['type' => 'trigger_form_assignee_missing', 'trigger_form_id' => $mapping->id],
                    $admin->id,
                );
            }
            return null;
        }

        // Non-sendable templates stay in-app even when a specific user is
        // assigned. Sendable templates email the assignee.
        $deliveryMethod = $mapping->formTemplate->is_sendable ? 'email' : 'in_app';

        return $this->formService->createAndSend(
            template: $mapping->formTemplate,
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
