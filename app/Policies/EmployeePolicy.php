<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;

class EmployeePolicy
{
    public function view(User $user, Employee $employee): bool
    {
        if ($user->can('employees.view-all')) {
            return true;
        }

        if ($employee->isOfficeStaff()) {
            return $user->can('employees.office.view');
        }

        return $user->can('employees.view')
            && $this->userManagesEmployeeViaKiosk($user, $employee);
    }

    public function sendDocuments(User $user, Employee $employee): bool
    {
        if (! $this->view($user, $employee)) {
            return false;
        }

        if ($employee->isOfficeStaff()) {
            return $user->can('employees.office.send-documents');
        }

        // Sending to field staff is an admin-level capability for now.
        return $user->can('employees.view-all');
    }

    private function userManagesEmployeeViaKiosk(User $user, Employee $employee): bool
    {
        return $user->managedKiosks()
            ->with('employees')
            ->get()
            ->flatMap(fn ($kiosk) => $kiosk->employees->pluck('eh_employee_id'))
            ->contains($employee->eh_employee_id);
    }
}
