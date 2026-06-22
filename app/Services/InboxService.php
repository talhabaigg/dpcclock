<?php

namespace App\Services;

use App\Models\EmploymentApplication;
use App\Models\FormRequest as FormRequestModel;
use App\Models\Injury;
use App\Models\User;

class InboxService
{
    /**
     * In-app form requests the user can complete: directly assigned by user id, or
     * permission-assigned and the user holds that permission. Email-delivered
     * forms are excluded — those reach their recipient by email link, not in-app.
     *
     * @return array{count: int, items: array<int, array<string, mixed>>}
     */
    public function pendingForUser(?User $user): array
    {
        if (! $user) {
            return ['count' => 0, 'items' => []];
        }

        $permissionNames = $user->getAllPermissions()->pluck('name');

        $requests = FormRequestModel::query()
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->whereIn('delivery_method', ['in_app', 'in_person'])
            ->where(function ($q) use ($user, $permissionNames) {
                $q->where(function ($q2) use ($user) {
                    $q2->where('assignee_strategy', 'user')
                        ->where('assignee_user_id', $user->id);
                });
                if ($permissionNames->isNotEmpty()) {
                    $q->orWhere(function ($q2) use ($permissionNames) {
                        $q2->where('assignee_strategy', 'permission')
                            ->whereIn('assignee_permission', $permissionNames);
                    });
                }
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->with(['formTemplate:id,name', 'formable'])
            ->latest()
            ->get();

        $items = $requests
            ->map(function (FormRequestModel $fr) {
                $url = $this->buildFormableUrl($fr);
                if (! $url) {
                    return null;
                }

                return [
                    'id' => $fr->id,
                    'form_name' => $fr->formTemplate?->name ?? 'Form',
                    'assignee_strategy' => $fr->assignee_strategy,
                    'created_at' => $fr->created_at->toISOString(),
                    'expires_at' => $fr->expires_at?->toISOString(),
                    'context_label' => $this->buildContextLabel($fr),
                    'context_type' => $this->formableLabel($fr->formable_type),
                    'url' => $url,
                ];
            })
            ->filter()
            ->values()
            ->all();

        return ['count' => count($items), 'items' => $items];
    }

    private function buildContextLabel(FormRequestModel $fr): ?string
    {
        $formable = $fr->formable;
        if (! $formable) {
            return null;
        }

        return match ($fr->formable_type) {
            Injury::class => $this->injuryLabel($formable),
            EmploymentApplication::class => trim($formable->full_name) ?: "Application #{$formable->id}",
            default => null,
        };
    }

    private function injuryLabel(Injury $injury): string
    {
        $name = $injury->employee?->preferred_name
            ?? $injury->employee?->name
            ?? $injury->employee_name
            ?? "Injury #{$injury->id}";
        $date = $injury->occurred_at?->format('j M Y');

        return $date ? "{$name} — {$date}" : $name;
    }

    private function formableLabel(?string $type): ?string
    {
        return match ($type) {
            Injury::class => 'Injury report',
            EmploymentApplication::class => 'Employment application',
            default => null,
        };
    }

    private function buildFormableUrl(FormRequestModel $fr): ?string
    {
        if (! $fr->formable_id) {
            return null;
        }

        return match ($fr->formable_type) {
            Injury::class => route('injury-register.show', $fr->formable_id).'?form_request='.$fr->id,
            EmploymentApplication::class => route('employment-applications.show', $fr->formable_id).'?form_request='.$fr->id,
            default => null,
        };
    }
}
