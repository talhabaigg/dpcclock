<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeFileType;
use App\Models\Location;
use App\Models\Worktype;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FileComplianceDashboardController extends Controller
{
    public function index(Request $request)
    {
        $employees = Employee::with(['worktypes', 'kiosks', 'employeeFiles.fileType'])
            ->orderBy('name')
            ->get();

        $fileTypes = EmployeeFileType::active()->orderBy('sort_order')->orderBy('name')->get();

        $complianceData = $employees->map(function (Employee $employee) use ($fileTypes) {
            $latest = $employee->employeeFiles
                ->sortByDesc('created_at')
                ->unique('employee_file_type_id')
                ->keyBy('employee_file_type_id');

            $requiredTypes = $fileTypes->filter(fn (EmployeeFileType $type) => $type->appliesToEmployee($employee));

            $statuses = $requiredTypes->mapWithKeys(function (EmployeeFileType $type) use ($latest) {
                $file = $latest->get($type->id);

                if ($file === null) {
                    return [$type->id => 'missing'];
                }

                // Only check expiry if the file type tracks expiry
                if ($type->expiry_requirement !== 'none') {
                    if ($file->isExpired()) {
                        return [$type->id => 'expired'];
                    }
                    if ($file->isExpiringSoon()) {
                        return [$type->id => 'expiring_soon'];
                    }
                }

                return [$type->id => 'valid'];
            });

            $nonCompliant = $statuses->filter(fn ($s) => in_array($s, ['missing', 'expired']))->count();
            $expiringSoon = $statuses->filter(fn ($s) => $s === 'expiring_soon')->count();

            return [
                'id' => $employee->id,
                'name' => $employee->display_name,
                'employment_type' => $employee->employment_type,
                'statuses' => $statuses,
                'overall' => $nonCompliant > 0 ? 'non_compliant' : ($expiringSoon > 0 ? 'expiring' : 'compliant'),
            ];
        });

        // Apply filters
        if ($request->filled('employment_type')) {
            $complianceData = $complianceData->filter(fn ($e) => $e['employment_type'] === $request->employment_type);
        }
        if ($request->filled('compliance_status')) {
            $complianceData = $complianceData->filter(fn ($e) => $e['overall'] === $request->compliance_status);
        }

        $summary = [
            'total' => $complianceData->count(),
            'compliant' => $complianceData->where('overall', 'compliant')->count(),
            'non_compliant' => $complianceData->where('overall', 'non_compliant')->count(),
            'expiring' => $complianceData->where('overall', 'expiring')->count(),
        ];

        return Inertia::render('compliance/files', [
            'employees' => $complianceData->values(),
            'fileTypes' => $fileTypes->map(fn ($t) => ['id' => $t->id, 'name' => $t->name]),
            'summary' => $summary,
            'filters' => $request->only(['employment_type', 'compliance_status']),
            'employmentTypes' => ['FullTime', 'PartTime', 'Casual'],
            'worktypes' => Worktype::orderBy('name')->get(['id', 'name']),
            'locations' => Location::whereNull('eh_parent_id')->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
