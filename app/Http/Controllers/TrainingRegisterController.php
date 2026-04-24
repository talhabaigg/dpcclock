<?php

namespace App\Http\Controllers;

use App\Exports\TrainingRegisterExport;
use App\Models\Employee;
use App\Models\EmployeeFile;
use App\Models\EmployeeFileType;
use App\Models\Kiosk;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class TrainingRegisterController extends Controller
{
    public function index(Request $request)
    {
        $data = $this->buildMatrix($request);

        return Inertia::render('training-register/index', [
            'rows' => $data['rows'],
            'kiosks' => $data['kiosks'],
            'fileTypes' => $data['fileTypes'],
            'visibleFileTypes' => $data['visibleFileTypes'],
            'filters' => $data['filters'],
        ]);
    }

    public function export(Request $request)
    {
        $data = $this->buildMatrix($request);

        $filename = 'training-register-' . now()->format('Y-m-d-His') . '.xlsx';

        return Excel::download(
            new TrainingRegisterExport($data['rows'], $data['visibleFileTypes']),
            $filename,
        );
    }

    /**
     * Build the shared data payload used by both index and export.
     *
     * @return array{
     *   rows: \Illuminate\Support\Collection,
     *   kiosks: \Illuminate\Support\Collection,
     *   fileTypes: \Illuminate\Support\Collection,
     *   filters: array<string, mixed>
     * }
     */
    protected function buildMatrix(Request $request): array
    {
        $user = $request->user();

        // Kiosks the user can see
        $accessibleQuery = Kiosk::query()->where('is_active', true);
        if (! $user->can('training-register.view-all')) {
            $managedIds = $user->managedKiosks()->pluck('kiosks.id');
            $accessibleQuery->whereIn('id', $managedIds);
        }
        $accessibleKiosks = $accessibleQuery
            ->orderBy('name')
            ->get(['id', 'eh_kiosk_id', 'name']);

        $accessibleKioskIds = $accessibleKiosks->pluck('id')->all();

        // Narrow by user-selected kiosk filter (must be subset of accessible)
        $filterKioskIds = collect((array) $request->input('kiosk_ids', []))
            ->map(fn ($v) => (int) $v)
            ->filter()
            ->intersect($accessibleKioskIds)
            ->values();

        $activeKioskIds = $filterKioskIds->isNotEmpty()
            ? $filterKioskIds->all()
            : $accessibleKioskIds;

        // File types (all active — column visibility is a frontend concern, export applies the filter explicitly)
        $allFileTypes = EmployeeFileType::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category']);

        $filterFileTypeIds = collect((array) $request->input('file_type_ids', []))
            ->map(fn ($v) => (int) $v)
            ->filter()
            ->values();

        $visibleFileTypes = $filterFileTypeIds->isNotEmpty()
            ? $allFileTypes->whereIn('id', $filterFileTypeIds)->values()
            : $allFileTypes;

        // Employees: active (not soft-deleted), attached to an active kiosk in scope
        $employeeQuery = Employee::query()
            ->with(['kiosks' => function ($q) use ($activeKioskIds) {
                $q->whereIn('kiosks.id', $activeKioskIds)->with('location:id,eh_location_id,external_id,name');
            }])
            ->whereHas('kiosks', function ($q) use ($activeKioskIds) {
                $q->whereIn('kiosks.id', $activeKioskIds);
            });

        if ($request->filled('search')) {
            $search = $request->string('search')->trim()->toString();
            $employeeQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('preferred_name', 'like', "%{$search}%");
            });
        }

        $employees = $employeeQuery
            ->orderBy('name')
            ->get(['id', 'eh_employee_id', 'name', 'preferred_name']);

        // Build validity matrix: employee_id => [file_type_id => true]
        $validFiles = EmployeeFile::query()
            ->whereIn('employee_id', $employees->pluck('id'))
            ->whereIn('employee_file_type_id', $allFileTypes->pluck('id'))
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()->startOfDay());
            })
            ->get(['employee_id', 'employee_file_type_id']);

        $matrix = [];
        foreach ($validFiles as $file) {
            $matrix[$file->employee_id][$file->employee_file_type_id] = true;
        }

        $visibleIds = $visibleFileTypes->pluck('id')->all();
        $visibleCount = count($visibleIds);

        $rows = $employees->map(function (Employee $emp) use ($matrix, $visibleIds, $visibleCount) {
            $validForEmp = $matrix[$emp->id] ?? [];
            $validInView = 0;
            foreach ($visibleIds as $fid) {
                if (isset($validForEmp[$fid])) {
                    $validInView++;
                }
            }
            return [
                'id' => $emp->id,
                'name' => $emp->preferred_name ?: $emp->name,
                'kiosks' => $emp->kiosks
                    ->sortBy('name')
                    ->values()
                    ->map(fn ($k) => [
                        'id' => $k->id,
                        'name' => $k->name,
                        'job_number' => $k->location?->external_id,
                    ])
                    ->all(),
                'files' => array_map('intval', array_keys($validForEmp)),
                'missing_count' => max(0, $visibleCount - $validInView),
            ];
        })->values();

        $sort = (string) $request->input('sort', 'missing_desc');
        $rows = match ($sort) {
            'name_asc' => $rows->sortBy(fn ($r) => strtolower($r['name']))->values(),
            'name_desc' => $rows->sortByDesc(fn ($r) => strtolower($r['name']))->values(),
            'missing_asc' => $rows->sortBy('missing_count')->values(),
            default => $rows->sortByDesc('missing_count')->values(),
        };

        $kiosksPayload = $accessibleKiosks
            ->map(fn ($k) => ['id' => $k->id, 'name' => $k->name])
            ->values();

        $fileTypesPayload = $allFileTypes
            ->map(fn (EmployeeFileType $ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
                'categories' => is_array($ft->category) && ! empty($ft->category) ? $ft->category : ['Uncategorised'],
            ])
            ->values();

        return [
            'rows' => $rows,
            'kiosks' => $kiosksPayload,
            'fileTypes' => $fileTypesPayload,
            'visibleFileTypes' => $visibleFileTypes->map(fn ($ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
            ])->values(),
            'filters' => [
                'search' => $request->input('search'),
                'kiosk_ids' => $filterKioskIds->all(),
                'file_type_ids' => $filterFileTypeIds->all(),
                'sort' => $sort,
            ],
        ];
    }
}
