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
            'employees.view' => 'View employee list',
            'employees.sync' => 'Sync employees from external system',
            'employees.manage-worktypes' => 'Manage employee work types',
        ],

        // ============================================
        // LOCATION MANAGEMENT
        // ============================================
        'Locations' => [
            'locations.view' => 'View locations',
            'locations.create' => 'Create new locations',
            'locations.edit' => 'Edit locations',
            'locations.delete' => 'Delete locations',
            'locations.sync' => 'Sync locations from external system',
            'locations.load-job-data' => 'Load job data from Premier',
        ],

        // ============================================
        // KIOSK MANAGEMENT
        // ============================================
        'Kiosks' => [
            'kiosks.view' => 'View kiosks',
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
        // QA STAGES
        // ============================================
        'QA Stages' => [
            'qa-stages.view' => 'View QA stages',
            'qa-stages.create' => 'Create QA stages',
            'qa-stages.delete' => 'Delete QA stages',
            'qa-drawings.view' => 'View QA drawings',
            'qa-drawings.create' => 'Upload QA drawings',
            'qa-drawings.delete' => 'Delete QA drawings',
            'qa-observations.manage' => 'Manage QA observations',
        ],

        // ============================================
        // REPORTS
        // ============================================
        'Reports' => [
            'reports.view' => 'View reports',
            'reports.requisition-lines' => 'View requisition line reports',
        ],

        // ============================================
        // SYSTEM & ADMIN
        // ============================================
        'System' => [
            'queue-status.view' => 'View queue status',
            'admin.roles' => 'Manage roles and permissions',
        ],

        // ============================================
        // AI FEATURES
        // ============================================
        'AI' => [
            'ai.chat' => 'Access AI chat features',
            'ai.voice' => 'Access AI voice call features',
        ],
    ];

    /**
     * Role definitions with their assigned permissions.
     */
    protected array $rolePermissions = [
        'admin' => '*', // All permissions

        'backoffice' => [
            // Dashboard
            'dashboard.view',
            // Users (view only, no role management)
            'users.view',
            'users.edit',
            // Employees
            'employees.view',
            'employees.sync',
            'employees.manage-worktypes',
            // Locations
            'locations.view',
            'locations.create',
            'locations.edit',
            'locations.sync',
            // Kiosks
            'kiosks.view',
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
            // Materials
            'materials.view',
            'materials.create',
            'materials.edit',
            'materials.delete',
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
            // Forecasting
            'forecast.view',
            'forecast.edit',
            'forecast.submit',
            'forecast.approve',
            'forecast.reject',
            'forecast-projects.view',
            'forecast-projects.create',
            'forecast-projects.edit',
            'forecast-projects.delete',
            'turnover-forecast.view',
            'cash-forecast.view',
            'cash-forecast.edit',
            // Variations
            'variations.view',
            'variations.create',
            'variations.edit',
            'variations.delete',
            'variations.sync',
            'variations.send',
            'variations.export',
            // QA
            'qa-stages.view',
            'qa-stages.create',
            'qa-stages.delete',
            'qa-drawings.view',
            'qa-drawings.create',
            'qa-drawings.delete',
            'qa-observations.manage',
            // Reports
            'reports.view',
            'reports.requisition-lines',
            // System
            'queue-status.view',
        ],

        'manager' => [
            // Dashboard
            'dashboard.view',
            // Users (limited)
            'users.view',
            // Employees
            'employees.view',
            'employees.manage-worktypes',
            // Locations
            'locations.view',
            'locations.edit',
            // Kiosks
            'kiosks.view',
            'kiosks.edit',
            'kiosks.manage-employees',
            'kiosks.retrieve-token',
            // Timesheets
            'timesheets.view',
            'timesheets.edit',
            'timesheets.review',
            'clocks.manage',
            // Calendar
            'calendar.view',
            'timesheet-events.create',
            'timesheet-events.edit',
            'timesheet-events.generate',
            // Worktypes
            'worktypes.view',
            // Requisitions
            'requisitions.view',
            'requisitions.view-all',
            'requisitions.create',
            'requisitions.edit',
            'requisitions.process',
            'requisitions.export',
            // Materials
            'materials.view',
            // Suppliers
            'suppliers.view',
            // Cost Codes
            'costcodes.view',
            'costtypes.view',
            // Forecasting
            'forecast.view',
            'forecast.edit',
            'forecast.submit',
            'forecast-projects.view',
            'turnover-forecast.view',
            'cash-forecast.view',
            // Variations
            'variations.view',
            'variations.create',
            'variations.edit',
            // QA
            'qa-stages.view',
            'qa-stages.create',
            'qa-drawings.view',
            'qa-drawings.create',
            'qa-observations.manage',
            // Reports
            'reports.view',
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
