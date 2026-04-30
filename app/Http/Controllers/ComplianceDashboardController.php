<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use App\Models\Employee;
use App\Models\EmployeeFileType;
use App\Models\SigningRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ComplianceDashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Get the user's managed kiosks with their locations
        $kiosks = $user->managedKiosks()->with('location')->get();

        // If user has view-all permission, get all active kiosks with employees
        if ($user->can('compliance-dashboard.view-all')) {
            $kiosks = \App\Models\Kiosk::where('is_active', true)
                ->with('location')
                ->whereHas('employees')
                ->get();
        }

        $kioskOptions = $kiosks->map(fn ($kiosk) => [
            'id' => $kiosk->id,
            'eh_kiosk_id' => $kiosk->eh_kiosk_id,
            'name' => $kiosk->name,
            'location_name' => $kiosk->location?->name,
        ])->values();

        // Determine the selected kiosk
        $selectedKioskId = $request->input('kiosk_id', $kiosks->first()?->eh_kiosk_id);

        $selectedKiosk = $kiosks->firstWhere('eh_kiosk_id', $selectedKioskId);
        if (! $selectedKiosk) {
            return Inertia::render('compliance-dashboard/index', [
                'kiosks' => $kioskOptions,
                'selectedKioskId' => null,
                'employees' => [],
                'fileTypes' => [],
                'summary' => ['expired' => 0, 'expiring_soon' => 0, 'missing' => 0, 'unsigned' => 0, 'total_workers' => 0, 'compliant' => 0],
                'fileTypeBreakdown' => [],
            ]);
        }

        // Get field staff at the selected kiosk
        $employees = Employee::fieldStaff()
            ->whereHas('kiosks', fn ($q) => $q->where('employee_kiosk.eh_kiosk_id', $selectedKioskId))
            ->with(['worktypes', 'kiosks', 'employeeFiles.fileType', 'signingRequests'])
            ->orderBy('name')
            ->get();

        $fileTypes = EmployeeFileType::active()->orderBy('sort_order')->orderBy('name')->get();

        // Get site-visible document template IDs for signing request filtering
        $siteTemplateIds = DocumentTemplate::active()
            ->whereIn('visibility', ['all', 'site_only'])
            ->pluck('id');

        // Build compliance data per employee
        $totalExpired = 0;
        $totalExpiringSoon = 0;
        $totalMissing = 0;
        $totalUnsigned = 0;
        $totalCompliant = 0;

        // Track per file-type counts
        $fileTypeIssues = [];

        $complianceData = $employees->map(function (Employee $employee) use ($fileTypes, $siteTemplateIds, &$totalExpired, &$totalExpiringSoon, &$totalMissing, &$totalUnsigned, &$totalCompliant, &$fileTypeIssues) {
            $latest = $employee->employeeFiles
                ->sortByDesc('created_at')
                ->unique('employee_file_type_id')
                ->keyBy('employee_file_type_id');

            // Resolve level per file type and drop those that don't apply (level = none).
            $requiredWithLevel = $fileTypes
                ->map(fn (EmployeeFileType $type) => [
                    'type' => $type,
                    'level' => $type->requirementForEmployee($employee),
                ])
                ->filter(fn (array $row) => $row['level'] !== EmployeeFileType::LEVEL_NONE);

            $expired = 0;
            $expiringSoon = 0;
            $missing = 0;
            $hasMandatoryIssue = false;
            $hasPreferredIssue = false;

            $statuses = $requiredWithLevel->mapWithKeys(function (array $row) use ($latest, &$expired, &$expiringSoon, &$missing, &$hasMandatoryIssue, &$hasPreferredIssue, &$fileTypeIssues) {
                $type = $row['type'];
                $level = $row['level'];
                $file = $latest->get($type->id);
                $status = 'valid';

                if ($file === null) {
                    $status = 'missing';
                    $missing++;
                } elseif ($type->expiry_requirement !== 'none') {
                    if ($file->isExpired()) {
                        $status = 'expired';
                        $expired++;
                    } elseif ($file->isExpiringSoon()) {
                        $status = 'expiring_soon';
                        $expiringSoon++;
                    }
                }

                // Track per file-type breakdown (mandatory/preferred only - optional gaps are info).
                if ($status !== 'valid' && $level !== EmployeeFileType::LEVEL_OPTIONAL) {
                    if (! isset($fileTypeIssues[$type->id])) {
                        $fileTypeIssues[$type->id] = ['expired' => 0, 'expiring_soon' => 0, 'missing' => 0];
                    }
                    $fileTypeIssues[$type->id][$status]++;
                }

                // Severity flags drive overall status.
                if ($level === EmployeeFileType::LEVEL_MANDATORY && in_array($status, ['expired', 'missing'], true)) {
                    $hasMandatoryIssue = true;
                }
                if ($level === EmployeeFileType::LEVEL_PREFERRED && in_array($status, ['expired', 'missing', 'expiring_soon'], true)) {
                    $hasPreferredIssue = true;
                }

                return [$type->id => ['status' => $status, 'level' => $level]];
            });

            // Count unsigned signing requests (site-visible templates only)
            $unsignedCount = $employee->signingRequests
                ->filter(fn (SigningRequest $sr) => $sr->isPending() && $siteTemplateIds->contains($sr->document_template_id))
                ->count();

            $totalExpired += $expired;
            $totalExpiringSoon += $expiringSoon;
            $totalMissing += $missing;
            $totalUnsigned += $unsignedCount;

            $overall = match (true) {
                $hasMandatoryIssue => 'non_compliant',
                $hasPreferredIssue || $expiringSoon > 0 || $unsignedCount > 0 => 'warning',
                default => 'compliant',
            };

            if ($overall === 'compliant') {
                $totalCompliant++;
            }

            return [
                'id' => $employee->id,
                'name' => $employee->display_name,
                'employment_type' => $employee->employment_type,
                'statuses' => $statuses,
                'expired_count' => $expired,
                'expiring_soon_count' => $expiringSoon,
                'missing_count' => $missing,
                'unsigned_count' => $unsignedCount,
                'overall' => $overall,
            ];
        });

        // Sort by severity: non-compliant first, then warning, then compliant
        $sortOrder = ['non_compliant' => 0, 'warning' => 1, 'compliant' => 2];
        $complianceData = $complianceData->sortBy(fn ($e) => $sortOrder[$e['overall']] ?? 3)->values();

        // Build file type breakdown with category for grouping
        $fileTypeBreakdown = $fileTypes
            ->filter(fn ($ft) => isset($fileTypeIssues[$ft->id]))
            ->map(fn ($ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
                'category' => $ft->category ?? [],
                'expired' => $fileTypeIssues[$ft->id]['expired'] ?? 0,
                'expiring_soon' => $fileTypeIssues[$ft->id]['expiring_soon'] ?? 0,
                'missing' => $fileTypeIssues[$ft->id]['missing'] ?? 0,
            ])
            ->sortByDesc(fn ($ft) => $ft['expired'] + $ft['missing'] + $ft['expiring_soon'])
            ->values();

        return Inertia::render('compliance-dashboard/index', [
            'kiosks' => $kioskOptions,
            'selectedKioskId' => $selectedKioskId,
            'employees' => $complianceData,
            'fileTypes' => $fileTypes->map(fn ($t) => ['id' => $t->id, 'name' => $t->name]),
            'summary' => [
                'expired' => $totalExpired,
                'expiring_soon' => $totalExpiringSoon,
                'missing' => $totalMissing,
                'unsigned' => $totalUnsigned,
                'total_workers' => $employees->count(),
                'compliant' => $totalCompliant,
            ],
            'fileTypeBreakdown' => $fileTypeBreakdown,
        ]);
    }
}
