/**
 * Settings Dialog Component
 *
 * PURPOSE:
 * Manages pay rate template configuration for a location/job.
 * Allows adding, removing, and customizing templates from KeyPay.
 *
 * FEATURES:
 * - Search and add pay rate templates from KeyPay
 * - Customize template labels and cost code prefixes
 * - Toggle overtime tracking per template
 * - View cost breakdowns and configure allowances
 * - View active shift conditions
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 *
 * PROPS:
 * - open: boolean - Controls dialog visibility
 * - onOpenChange: (open: boolean) => void - Callback when dialog state changes
 * - configuredTemplates: Templates currently configured for this location
 * - availableTemplates: All available templates from KeyPay
 * - locationWorktypes: Active shift conditions for the location
 * - locationId: Location ID for API calls
 * - flash: Flash messages from the server
 * - onOpenCostBreakdown: Callback to open cost breakdown dialog
 * - onOpenAllowanceDialog: Callback to open allowance configuration dialog
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { Calculator, Check, DollarSign, Info, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AvailableTemplate, ConfiguredTemplate, LocationWorktype } from '../types';
import { formatCurrency } from './utils';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    configuredTemplates: ConfiguredTemplate[];
    availableTemplates: AvailableTemplate[];
    locationWorktypes: LocationWorktype[];
    locationId: number;
    flash?: { success?: string; error?: string };
    onOpenCostBreakdown: (template: ConfiguredTemplate) => void;
    onOpenAllowanceDialog: (template: ConfiguredTemplate) => void;
}

export const SettingsDialog = ({
    open,
    onOpenChange,
    configuredTemplates,
    availableTemplates,
    locationWorktypes,
    locationId,
    flash,
    onOpenCostBreakdown,
    onOpenAllowanceDialog,
}: SettingsDialogProps) => {
    // Local state for editing
    const [editingLabel, setEditingLabel] = useState<{ id: number; label: string } | null>(null);
    const [editingCostCode, setEditingCostCode] = useState<{ id: number; costCodePrefix: string } | null>(null);
    const [newTemplateId, setNewTemplateId] = useState<string>('');
    const [templateSearch, setTemplateSearch] = useState('');

    // Handle adding a new template
    const handleAddTemplate = () => {
        if (!newTemplateId) return;
        router.post(route('labour-forecast.add-template', { location: locationId }), { template_id: newTemplateId }, { preserveScroll: true });
        setNewTemplateId('');
        setTemplateSearch('');
    };

    // Handle removing a template
    const handleRemoveTemplate = (configId: number) => {
        if (!confirm('Are you sure you want to remove this template?')) return;
        router.delete(route('labour-forecast.remove-template', { location: locationId, template: configId }), { preserveScroll: true });
    };

    // Handle updating a template label
    const handleUpdateLabel = () => {
        if (!editingLabel) return;
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: editingLabel.id }),
            { label: editingLabel.label },
            { preserveScroll: true },
        );
        setEditingLabel(null);
    };

    // Handle updating a template cost code prefix
    const handleUpdateCostCode = () => {
        if (!editingCostCode) return;
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: editingCostCode.id }),
            { cost_code_prefix: editingCostCode.costCodePrefix },
            { preserveScroll: true },
        );
        setEditingCostCode(null);
    };

    // Handle toggling overtime for a template
    const handleToggleOvertime = (templateId: number, enabled: boolean) => {
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: templateId }),
            { overtime_enabled: enabled },
            { preserveScroll: true },
        );
    };

    // Handle toggling leave markups job costed for a template
    const handleToggleLeaveMarkupsJobCosted = (templateId: number, enabled: boolean) => {
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: templateId }),
            { leave_markups_job_costed: enabled },
            { preserveScroll: true },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Configure Pay Rate Templates
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Flash messages */}
                    {flash?.success && (
                        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            {flash.success}
                        </div>
                    )}
                    {flash?.error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{flash.error}</div>
                    )}

                    {/* Add new template */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-medium">Add Template</h3>
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search templates..."
                                    value={templateSearch}
                                    onChange={(e) => {
                                        setTemplateSearch(e.target.value);
                                        setNewTemplateId('');
                                    }}
                                    className="flex-1"
                                />
                                <Button onClick={handleAddTemplate} disabled={!newTemplateId}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add
                                </Button>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                                {availableTemplates.filter((t) =>
                                    t.name.toLowerCase().includes(templateSearch.toLowerCase())
                                ).length === 0 ? (
                                    <div className="p-3 text-center text-sm text-slate-500">No templates found.</div>
                                ) : (
                                    availableTemplates
                                        .filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                        .map((template) => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                                    newTemplateId === String(template.id) ? 'bg-slate-100 dark:bg-slate-800' : ''
                                                }`}
                                                onClick={() => {
                                                    setNewTemplateId(String(template.id));
                                                    setTemplateSearch(template.name);
                                                }}
                                            >
                                                <Check
                                                    className={`h-4 w-4 ${
                                                        newTemplateId === String(template.id) ? 'opacity-100' : 'opacity-0'
                                                    }`}
                                                />
                                                <span className="flex-1 text-left">{template.name}</span>
                                                {template.hourly_rate && (
                                                    <span className="text-xs text-slate-500">
                                                        {formatCurrency(template.hourly_rate)}/hr
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Configured templates list */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-medium">Configured Templates</h3>
                        {configuredTemplates.length === 0 ? (
                            <p className="text-sm text-slate-500">No templates configured. Add templates above to get started.</p>
                        ) : (
                            <div className="space-y-2">
                                {configuredTemplates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                                    >
                                        <div className="min-w-0 flex-1">
                                            {editingLabel?.id === template.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editingLabel.label}
                                                        onChange={(e) => setEditingLabel({ ...editingLabel, label: e.target.value })}
                                                        placeholder="Custom label"
                                                        className="h-8"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateLabel();
                                                            if (e.key === 'Escape') setEditingLabel(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <Button size="sm" onClick={handleUpdateLabel}>
                                                        Save
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => setEditingLabel(null)}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{template.label}</span>
                                                    {template.label !== template.name && (
                                                        <span className="text-xs text-slate-500">({template.name})</span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <DollarSign className="h-3 w-3" />
                                                    {formatCurrency(template.hourly_rate)}/hr
                                                </span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-green-600 underline decoration-dotted underline-offset-2 dark:text-green-400">
                                                            Weekly Cost: {formatCurrency(template.cost_breakdown.total_weekly_cost)}
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="max-w-xs">
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between gap-4">
                                                                <span>Base Wages ({template.cost_breakdown.hours_per_week}hrs)</span>
                                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.base_weekly_wages)}</span>
                                                            </div>
                                                            {template.cost_breakdown.allowances.total > 0 && (
                                                                <div className="flex justify-between gap-4">
                                                                    <span>+ Allowances</span>
                                                                    <span className="font-medium">{formatCurrency(template.cost_breakdown.allowances.total)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between gap-4">
                                                                <span>+ Leave Accruals</span>
                                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.leave_markups.annual_leave_amount + template.cost_breakdown.leave_markups.leave_loading_amount)}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span>+ Super</span>
                                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.super)}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span>+ On-Costs</span>
                                                                <span className="font-medium">{formatCurrency(template.cost_breakdown.on_costs.total)}</span>
                                                            </div>
                                                            <div className="flex justify-between gap-4 border-t border-slate-600 pt-1 font-semibold text-green-400">
                                                                <span>Total Weekly Cost</span>
                                                                <span>{formatCurrency(template.cost_breakdown.total_weekly_cost)}</span>
                                                            </div>
                                                            <p className="pt-1 text-[10px] text-slate-400">Click calculator icon for full breakdown</p>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            {/* Custom Allowances Badge */}
                                            {template.custom_allowances && template.custom_allowances.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {template.custom_allowances.map((allowance) => (
                                                        <span
                                                            key={allowance.id}
                                                            className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                                            title={`${formatCurrency(allowance.rate)}/${allowance.rate_type} = ${formatCurrency(allowance.weekly_cost)}/week`}
                                                        >
                                                            {allowance.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Cost Code Prefix */}
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Cost Code:</span>
                                                {editingCostCode?.id === template.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            value={editingCostCode.costCodePrefix}
                                                            onChange={(e) => setEditingCostCode({ ...editingCostCode, costCodePrefix: e.target.value })}
                                                            placeholder="e.g., 03"
                                                            className="h-6 w-16 text-xs"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleUpdateCostCode();
                                                                if (e.key === 'Escape') setEditingCostCode(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button size="sm" className="h-6 px-2 text-xs" onClick={handleUpdateCostCode}>
                                                            Save
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setEditingCostCode(null)}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingCostCode({ id: template.id, costCodePrefix: template.cost_code_prefix || '' })}
                                                        className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                                    >
                                                        {template.cost_code_prefix ? `${template.cost_code_prefix}-01` : 'Not set'}
                                                    </button>
                                                )}
                                            </div>
                                            {/* Overtime Toggle */}
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Overtime:</span>
                                                <Switch
                                                    checked={template.overtime_enabled}
                                                    onCheckedChange={(checked) => handleToggleOvertime(template.id, checked)}
                                                />
                                                <span className={`text-xs ${template.overtime_enabled ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>
                                                    {template.overtime_enabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                            {/* Leave Markups Job Costed Toggle */}
                                            <div className="mt-2 flex items-center gap-2">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-xs text-slate-500 underline decoration-dotted underline-offset-2">
                                                            Leave Markups Job Costed:
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        <p className="text-xs">
                                                            When disabled (default), only oncosts are job costed for leave hours.
                                                            When enabled, leave markups (annual leave accrual + leave loading) are also job costed.
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Switch
                                                    checked={template.leave_markups_job_costed}
                                                    onCheckedChange={(checked) => handleToggleLeaveMarkupsJobCosted(template.id, checked)}
                                                />
                                                <span className={`text-xs ${template.leave_markups_job_costed ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                                    {template.leave_markups_job_costed ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>
                                        {!editingLabel && !editingCostCode && (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-indigo-500 hover:text-indigo-700"
                                                    onClick={() => onOpenCostBreakdown(template)}
                                                    title="View cost breakdown"
                                                >
                                                    <Calculator className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-green-500 hover:text-green-700"
                                                    onClick={() => onOpenAllowanceDialog(template)}
                                                    title="Configure allowances"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setEditingLabel({ id: template.id, label: template.label })}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => handleRemoveTemplate(template.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-slate-500">
                        Templates are sourced from KeyPay Pay Rate Templates. Hourly rates are based on the "Permanent Ordinary Hours" pay
                        category.
                    </p>

                    {/* Location Worktypes (Shift Conditions) */}
                    {locationWorktypes.length > 0 && (
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                                <Info className="h-4 w-4 text-slate-400" />
                                Active Shift Conditions
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {locationWorktypes.map((wt) => (
                                    <span
                                        key={wt.id}
                                        className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                    >
                                        {wt.name}
                                    </span>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                These shift conditions affect allowance calculations in job costing.
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
