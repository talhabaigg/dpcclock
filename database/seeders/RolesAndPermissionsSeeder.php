<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Permission categories with their permissions.
     * Format: 'category' => ['permission.name' => 'Description']
     */
    protected array $permissionsByCategory = [
        // ============================================
        // DASHBOARD & CORE ACCESS
        // ============================================
        'Dashboard' => [
            'dashboard.view' => 'Access main dashboard',
        ],

        // ============================================
        // USER MANAGEMENT
        // ============================================
        'Users' => [
            'users.view' => 'View user list',
            'users.edit' => 'Edit user details',
            'users.update' => 'Update user information',
            'users.manage-roles' => 'Assign roles to users',
        ],

        // ============================================
        // EMPLOYEE MANAGEMENT
        // ============================================
        'Employees' => [
            'employees.view' => 'View employees assigned to your kiosks',
            'employees.view-all' => 'View all employees (across all kiosks)',
            'employees.sync' => 'Sync employees from external system',
            'employees.manage-worktypes' => 'Manage employee work types',
        ],

        // ============================================
        // LOCATION MANAGEMENT
        // ============================================
        'Locations' => [
            'locations.view' => 'View locations',
            'locations.view-all' => 'View all locations (across all projects)',
            'locations.create' => 'Create new locations',
            'locations.edit' => 'Edit locations',
            'locations.delete' => 'Delete locations',
            'locations.close' => 'Close and reopen projects',
            'locations.sync' => 'Sync locations from external system',
            'locations.load-job-data' => 'Load job data from Premier',
            'project-dashboard.view' => 'View project dashboard',
            'locations.dashboard.view' => 'View individual location dashboard',
        ],

        // ============================================
        // SAFETY DATA SHEETS (SDS)
        // ============================================
        'SDS' => [
            'sds.view' => 'View SDS register',
            'sds.manage' => 'Create, edit, delete safety data sheets',
        ],

        // ============================================
        // INJURY REGISTER
        // ============================================
        'Injury Register' => [
            'injury-register.view' => 'View injury register (scoped to managed locations)',
            'injury-register.view-all' => 'View all injuries across all locations',
            'injury-register.create' => 'Report new injuries',
            'injury-register.edit' => 'Edit injury records',
            'injury-register.delete' => 'Delete injury records',
            'injury-register.lock' => 'Lock/unlock injury records',
            'injury-register.export' => 'Export injury register',
        ],

        // ============================================
        // DAILY PRESTARTS
        // ============================================
        'Daily Prestarts' => [
            'prestarts.view' => 'View daily prestarts',
            'prestarts.create' => 'Create daily prestarts',
            'prestarts.edit' => 'Edit daily prestarts',
            'prestarts.delete' => 'Delete daily prestarts',
        ],

        // ============================================
        // KIOSK MANAGEMENT
        // ============================================
        'Kiosks' => [
            'kiosks.view' => 'View kiosks',
            'kiosks.view-all' => 'View all kiosks (across all locations)',
            'kiosks.edit' => 'Edit kiosk settings',
            'kiosks.manage-zones' => 'Update travel zones',
            'kiosks.toggle-active' => 'Toggle kiosk active status',
            'kiosks.manage-employees' => 'Add/remove employees from kiosks',
            'kiosks.manage-managers' => 'Assign kiosk managers',
            'kiosks.retrieve-token' => 'Retrieve kiosk authentication tokens',
            'kiosks.sync' => 'Sync kiosks from external system',
        ],

        // ============================================
        // TIMESHEET & CLOCK MANAGEMENT
        // ============================================
        'Timesheets' => [
            'timesheets.view' => 'View timesheets',
            'timesheets.edit' => 'Edit timesheet entries',
            'timesheets.review' => 'Review and approve timesheets',
            'timesheets.sync' => 'Sync timesheets with external system',
            'timesheets.convert' => 'Use timesheet converter tool',
            'clocks.manage' => 'Manage clock entries',
            'clocks.delete' => 'Delete clock entries',
        ],

        // ============================================
        // TIMESHEET EVENTS (CALENDAR)
        // ============================================
        'Calendar' => [
            'calendar.view' => 'View calendar',
            'timesheet-events.create' => 'Create timesheet events',
            'timesheet-events.edit' => 'Edit timesheet events',
            'timesheet-events.delete' => 'Delete timesheet events',
            'timesheet-events.generate' => 'Generate timesheets from events',
        ],

        // ============================================
        // WORK TYPES
        // ============================================
        'Worktypes' => [
            'worktypes.view' => 'View work types',
            'worktypes.create' => 'Create work types',
            'worktypes.edit' => 'Edit work types',
            'worktypes.delete' => 'Delete work types',
            'worktypes.sync' => 'Sync work types from external system',
        ],

        // ============================================
        // PROJECT CALENDAR (per-project non-work days + working week)
        // ============================================
        'Project Calendar' => [
            'project-calendar.view' => 'View project calendar',
            'project-calendar.manage' => 'Manage project non-work days and working week',
        ],

        // ============================================
        // REQUISITIONS & PURCHASING
        // ============================================
        'Requisitions' => [
            'requisitions.view' => 'View requisitions',
            'requisitions.view-all' => 'View all requisitions (across all locations)',
            'requisitions.create' => 'Create requisitions',
            'requisitions.edit' => 'Edit requisitions',
            'requisitions.delete' => 'Delete requisitions',
            'requisitions.process' => 'Process/approve requisitions',
            'requisitions.approve-pricing' => 'Approve pricing and send from office review',
            'requisitions.send' => 'Send requisitions to suppliers',
            'requisitions.export' => 'Export requisitions (PDF/Excel)',
        ],

        // ============================================
        // MATERIAL ITEMS
        // ============================================
        'Materials' => [
            'materials.view' => 'View material items',
            'materials.create' => 'Create material items',
            'materials.edit' => 'Edit material items',
            'materials.delete' => 'Delete material items',
            'materials.bulk-delete' => 'Bulk delete material items',
            'materials.import' => 'Import material items',
            'materials.export' => 'Export material items',
        ],

        // ============================================
        // SUPPLIERS
        // ============================================
        'Suppliers' => [
            'suppliers.view' => 'View suppliers',
            'suppliers.import' => 'Import suppliers',
            'suppliers.export' => 'Export suppliers',
        ],

        // ============================================
        // COST CODES & COST TYPES
        // ============================================
        'Cost Codes' => [
            'costcodes.view' => 'View cost codes',
            'costcodes.create' => 'Create cost codes',
            'costcodes.edit' => 'Edit cost codes',
            'costcodes.delete' => 'Delete cost codes',
            'costcodes.import' => 'Import cost codes',
            'costcodes.export' => 'Export cost codes',
            'costtypes.view' => 'View cost types',
            'costtypes.import' => 'Import cost types',
            'costtypes.export' => 'Export cost types',
        ],

        // ============================================
        // FORECASTING
        // ============================================
        'Forecasting' => [
            'forecast.view' => 'View forecasts',
            'forecast.edit' => 'Edit forecast data',
            'forecast.submit' => 'Submit forecasts for approval',
            'forecast.approve' => 'Approve/finalize forecasts',
            'forecast.reject' => 'Reject forecasts',
            'forecast-projects.view' => 'View forecast projects',
            'forecast-projects.create' => 'Create forecast projects',
            'forecast-projects.edit' => 'Edit forecast projects',
            'forecast-projects.delete' => 'Delete forecast projects',
            'turnover-forecast.view' => 'View turnover forecast',
            'cash-forecast.view' => 'View cash forecast',
            'cash-forecast.edit' => 'Edit cash forecast settings',
        ],

        // ============================================
        // BUDGET MANAGEMENT
        // ============================================
        'Budget' => [
            'budget.view' => 'View budget management',
            'budget.edit' => 'Edit budget targets',
        ],

        // ============================================
        // VARIATIONS
        // ============================================
        'Variations' => [
            'variations.view' => 'View variations',
            'variations.create' => 'Create variations',
            'variations.edit' => 'Edit variations',
            'variations.delete' => 'Delete variations',
            'variations.sync' => 'Sync variations from Premier',
            'variations.send' => 'Send variations to Premier',
            'variations.export' => 'Export variations',
        ],

        // ============================================
        // DRAWINGS
        // ============================================
        'Drawings' => [
            'drawings.view' => 'View drawings',
            'drawings.create' => 'Upload and edit drawings',
            'drawings.delete' => 'Delete drawings',
        ],

        // ============================================
        // DRAWING VIEWER (per-tab granular access)
        // ============================================
        'Drawing Viewer' => [
            'takeoff.view' => 'View takeoff tab and measurements',
            'takeoff.edit' => 'Create/edit/delete measurements, calibrate, manage conditions & bid areas',
            'production.view' => 'View production tab',
            'production.edit' => 'Update measurement & segment production statuses',
            'budget.view' => 'View budget tab & hours history',
            'budget.edit' => 'Store/edit budget hours',
            'qa.view' => 'View QA tab, observations & comparisons',
        ],

        // ============================================
        // REPORTS
        // ============================================
        'Reports' => [
            'reports.view' => 'View reports',
            'reports.requisition-lines' => 'View requisition line reports',
            'reports.missing-sign-out' => 'View missing sign-out report',
            'reports.safety-dashboard' => 'View safety dashboard',
            'reports.wip' => 'View WIP report',
            'reports.timesheet-vs-dpc' => 'View timesheet vs DPC report',
        ],

        // ============================================
        // SYSTEM & ADMIN
        // ============================================
        'System' => [
            'queue-status.view' => 'View queue status',
            'admin.roles' => 'Manage roles and permissions',
        ],

        // ============================================
        // EMPLOYMENT APPLICATIONS
        // ============================================
        'Employment Enquiries' => [
            'employment-applications.view' => 'View employment enquiries',
            'employment-applications.screen' => 'Screen enquiries (change status up to face-to-face, tick checklists)',
            'employment-applications.whs-review' => 'Send enquiry to WHS Review',
            'employment-applications.whs' => 'WHS reviewer (move from WHS Review to Final Review)',
            'employment-applications.approve' => 'Approve enquiries (move from Final Review to approved)',
        ],

        // ============================================
        // DOCUMENT TEMPLATES & SIGNING
        // ============================================
        'Document Templates' => [
            'document-templates.manage' => 'Create and manage document templates for signing',
        ],

        // ============================================
        // CHECKLISTS
        // ============================================
        'Checklists' => [
            'checklists.manage-templates' => 'Create, edit, delete checklist templates',
        ],

        // ============================================
        // WORKER SCREENING
        // ============================================
        'Worker Screening' => [
            'worker-screening.search' => 'Search worker screening records',
            'worker-screening.manage' => 'Add, edit, and remove worker screening entries',
        ],

        // ============================================
        // LABOUR DASHBOARD
        // ============================================
        'Labour Dashboard' => [
            'labour-dashboard.view' => 'View labour dashboard (scoped to managed locations)',
            'labour-dashboard.view-all' => 'View labour dashboard for all locations',
        ],

        // ============================================
        // AI FEATURES
        // ============================================
        'AI' => [
            'ai.chat' => 'Access AI chat features',
            'ai.voice' => 'Access AI voice call features',
        ],

        // ============================================
        // CREDIT CARD RECEIPTS
        // ============================================
        'Credit Card Receipts' => [
            'receipts.view' => 'Upload and view own credit card receipts',
            'receipts.manage' => 'Manage all receipts: view, edit, delete all users receipts and export',
        ],
    ];

    /**
     * Role definitions with their assigned permissions.
     */
    protected array $rolePermissions = [
        'admin' => '*', // All permissions

        'office-admin' => [
            // Dashboard
            'dashboard.view',
            // Users (view only, no role management)
            'users.view',
            'users.edit',
            // Employees
            'employees.view',
            'employees.view-all',
            'employees.sync',
            'employees.manage-worktypes',
            // Locations (no close — admin/PM only)
            'locations.view',
            'locations.view-all',
            'locations.create',
            'locations.edit',
            'locations.sync',
            // Kiosks
            'kiosks.view',
            'kiosks.view-all',
            'kiosks.edit',
            'kiosks.manage-zones',
            'kiosks.toggle-active',
            'kiosks.manage-employees',
            'kiosks.manage-managers',
            'kiosks.retrieve-token',
            'kiosks.sync',
            // Timesheets
            'timesheets.view',
            'timesheets.edit',
            'timesheets.review',
            'timesheets.sync',
            'timesheets.convert',
            'clocks.manage',
            // Calendar
            'calendar.view',
            'timesheet-events.create',
            'timesheet-events.edit',
            'timesheet-events.delete',
            'timesheet-events.generate',
            // Project Calendar
            'project-calendar.view',
            'project-calendar.manage',
            // Worktypes
            'worktypes.view',
            'worktypes.create',
            'worktypes.edit',
            'worktypes.sync',
            // Requisitions
            'requisitions.view',
            'requisitions.view-all',
            'requisitions.create',
            'requisitions.edit',
            'requisitions.delete',
            'requisitions.process',
            'requisitions.approve-pricing',
            'requisitions.send',
            'requisitions.export',
            // Materials (no delete — admin only)
            'materials.view',
            'materials.create',
            'materials.edit',
            'materials.import',
            'materials.export',
            // Suppliers
            'suppliers.view',
            'suppliers.import',
            'suppliers.export',
            // Cost Codes
            'costcodes.view',
            'costcodes.import',
            'costcodes.export',
            'costtypes.view',
            'costtypes.import',
            'costtypes.export',
            // Reports (no WIP, missing sign-out, or safety dashboard)
            'reports.view',
            'reports.requisition-lines',
            // System
            'queue-status.view',
            // Employment Applications
            'employment-applications.view',
            'employment-applications.screen',
            // Worker Screening (search only — manage is compliance-sensitive)
            'worker-screening.search',
            // Credit Card Receipts (own only, no manage)
            'receipts.view',
            // Injury Register
            'injury-register.view',
            'injury-register.view-all',
            'injury-register.create',
            'injury-register.edit',
            'injury-register.export',
            // Daily Prestarts
            'prestarts.view',
            'prestarts.create',
            'prestarts.edit',
            'prestarts.delete',
        ],

        'site-supervisor' => [
            // Dashboard (scoped to their project via kiosk manager relation)
            'dashboard.view',
            // Employees (view list only)
            'employees.view',
            // Locations
            'locations.view',
            'project-dashboard.view',
            'locations.dashboard.view',
            // SDS (read only)
            'sds.view',
            // Kiosks (scoped to their assigned kiosk)
            'kiosks.view',
            'kiosks.retrieve-token',
            // Timesheets (manage/review their employees via kiosk relation)
            'timesheets.view',
            'timesheets.edit',
            'timesheets.review',
            'clocks.manage',
            // Requisitions (scoped to their location via kiosk relation)
            'requisitions.view',
            'requisitions.create',
            'requisitions.edit',
            'requisitions.process',
            'requisitions.send',
            'requisitions.export',
            // Project Calendar (view/manage their own project's non-work days + working week)
            'project-calendar.view',
            'project-calendar.manage',
            // Materials (view material list only)
            'materials.view',
            // Worker Screening (search only)
            'worker-screening.search',
            // Injury Register
            'injury-register.view',
            'injury-register.create',
            'injury-register.edit',
            // Daily Prestarts
            'prestarts.view',
            'prestarts.create',
            'prestarts.edit',
        ],

        'director' => [
            // Dashboard
            'dashboard.view',
            // Locations (full visibility)
            'locations.view',
            'locations.view-all',
            'project-dashboard.view',
            'locations.dashboard.view',
            // Employees
            'employees.view',
            'employees.view-all',
            // Employment Applications
            'employment-applications.view',
            'employment-applications.approve',
            // Forecasting (view + approve/reject)
            'forecast.view',
            'forecast.approve',
            'forecast.reject',
            'forecast-projects.view',
            'turnover-forecast.view',
            'cash-forecast.view',
            // Budget
            'budget.view',
            // Reports
            'reports.view',
            'reports.safety-dashboard',
            'reports.wip',
            'reports.timesheet-vs-dpc',
            // Credit Card Receipts (own only)
            'receipts.view',
            // AI
            'ai.chat',
            'ai.voice',
            // Injury Register (view + export)
            'injury-register.view',
            'injury-register.view-all',
            'injury-register.export',
            // Labour Dashboard
            'labour-dashboard.view',
            'labour-dashboard.view-all',
        ],

        'kiosk' => [
            'dashboard.view',
            'kiosks.view',
            'clocks.manage',
        ],
    ];

    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create all permissions
        $allPermissions = [];
        foreach ($this->permissionsByCategory as $category => $permissions) {
            foreach ($permissions as $name => $description) {
                Permission::firstOrCreate(
                    ['name' => $name, 'guard_name' => 'web'],
                );
                $allPermissions[] = $name;
            }
        }

        // Create roles and assign permissions
        foreach ($this->rolePermissions as $roleName => $permissions) {
            $role = Role::firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web'],
            );

            if ($permissions === '*') {
                // Admin gets all permissions
                $role->syncPermissions($allPermissions);
            } else {
                $role->syncPermissions($permissions);
            }
        }

        // Clean up old permissions that are no longer used
        $this->cleanupOldPermissions($allPermissions);
    }

    /**
     * Remove permissions that are no longer defined.
     */
    protected function cleanupOldPermissions(array $currentPermissions): void
    {
        Permission::whereNotIn('name', $currentPermissions)->delete();
    }

    /**
     * Get all permission categories (useful for UI grouping).
     */
    public static function getCategories(): array
    {
        return array_keys((new self)->permissionsByCategory);
    }

    /**
     * Get permissions by category (useful for UI display).
     */
    public static function getPermissionsByCategory(): array
    {
        return (new self)->permissionsByCategory;
    }
}
