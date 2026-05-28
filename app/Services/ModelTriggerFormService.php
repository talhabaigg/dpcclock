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
     * required forms haven't been submitted yet. Empty array = ok to move.
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
            $hasSubmitted = FormRequest::query()
                ->where('formable_type', get_class($formable))
                ->where('formable_id', $formable->getKey())
                ->where('form_template_id', $mapping->form_template_id)
                ->where('status', 'submitted')
                ->exists();

            if (! $hasSubmitted) {
                $blockers[] = $mapping->formTemplate->name;
            }
        }

        return $blockers;
    }

    /**
     * Dispatch all forms configured for the given trigger key. Idempotent —
     * skips if a non-cancelled FormRequest already exists for the same template.
     *
     * @return Collection<int, FormRequest>
     */
    public function dispatchFormsFor(Model $formable, string $triggerKey, User $admin): Collection
    {
        $created = collect();

        $mappings = $this->activeMappingsFor($formable, $triggerKey);

        foreach ($mappings as $mapping) {
            $existing = FormRequest::query()
                ->where('formable_type', get_class($formable))
                ->where('formable_id', $formable->getKey())
                ->where('form_template_id', $mapping->form_template_id)
                ->whereIn('status', ['pending', 'sent', 'opened', 'submitted'])
                ->exists();

            if ($existing) {
                continue;
            }

            // Permission-based mapping = in-app, visible to anyone with the
            // permission. Doesn't pick a specific user, doesn't send email.
            // Senior roles that include the permission automatically qualify.
            if ($mapping->assignee_strategy === 'permission') {
                $formRequest = $this->formService->createAndSend(
                    template: $mapping->formTemplate,
                    deliveryMethod: 'in_app',
                    admin: $admin,
                    recipientName: "Anyone with permission: {$mapping->assignee_value}",
                    recipientEmail: null,
                    formable: $formable,
                    assigneeStrategy: 'permission',
                    assigneePermission: $mapping->assignee_value,
                );
                $created->push($formRequest);
                continue;
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
                continue;
            }

            // Non-sendable templates stay in-app even when a specific user is
            // assigned. Sendable templates email the assignee.
            $deliveryMethod = $mapping->formTemplate->is_sendable ? 'email' : 'in_app';

            $formRequest = $this->formService->createAndSend(
                template: $mapping->formTemplate,
                deliveryMethod: $deliveryMethod,
                admin: $admin,
                recipientName: $assignee->name,
                recipientEmail: $deliveryMethod === 'email' ? $assignee->email : null,
                formable: $formable,
                assigneeStrategy: 'user',
                assigneeUserId: $assignee->id,
            );

            $created->push($formRequest);
        }

        return $created;
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
}
