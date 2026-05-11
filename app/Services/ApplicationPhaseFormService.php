<?php

namespace App\Services;

use App\Models\ApplicationPhaseForm;
use App\Models\FormRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class ApplicationPhaseFormService
{
    public function __construct(
        private FormService $formService,
    ) {}

    /**
     * Reasons why a transition out of the current status is blocked because
     * required phase forms haven't been submitted yet. Empty array = ok to move.
     *
     * @return array<int, string>
     */
    public function blockersForLeaving(Model $formable, string $currentStatus): array
    {
        $mappings = $this->activeMappingsFor($formable, $currentStatus)
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
     * Dispatch all phase forms configured for the new status. Idempotent —
     * skips if a non-cancelled FormRequest already exists for the same template.
     *
     * @return Collection<int, FormRequest>
     */
    public function dispatchFormsFor(Model $formable, string $newStatus, User $admin): Collection
    {
        $created = collect();

        $mappings = $this->activeMappingsFor($formable, $newStatus);

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

            $assignee = $mapping->resolveAssignee();

            if (! $assignee) {
                if (method_exists($formable, 'addSystemComment')) {
                    $formable->addSystemComment(
                        "Unable to send \"{$mapping->formTemplate->name}\": no user matched assignee \"{$mapping->assignee_value}\"",
                        ['type' => 'phase_form_assignee_missing', 'phase_form_id' => $mapping->id],
                        $admin->id,
                    );
                }
                continue;
            }

            $formRequest = $this->formService->createAndSend(
                template: $mapping->formTemplate,
                deliveryMethod: 'email',
                admin: $admin,
                recipientName: $assignee->name,
                recipientEmail: $assignee->email,
                formable: $formable,
            );

            $created->push($formRequest);
        }

        return $created;
    }

    /**
     * @return Collection<int, ApplicationPhaseForm>
     */
    private function activeMappingsFor(Model $formable, string $status): Collection
    {
        return ApplicationPhaseForm::query()
            ->active()
            ->forModelStatus(get_class($formable), $status)
            ->with('formTemplate')
            ->get();
    }
}
