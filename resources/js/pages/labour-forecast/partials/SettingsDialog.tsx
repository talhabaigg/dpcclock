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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { Calculator, Check, ChevronDown, HelpCircle, Info, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
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
    const [showHelp, setShowHelp] = useState(false);

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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 shrink-0" />
                        <span className="truncate">Configure Pay Rate Templates</span>
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

                    {/* How to Use Guide */}
                    <Collapsible open={showHelp} onOpenChange={setShowHelp}>
                        <CollapsibleTrigger asChild>
                            <Button variant="outline" className="w-full justify-between" size="sm">
                                <span className="flex items-center gap-2">
                                    <HelpCircle className="h-4 w-4 text-blue-500" />
                                    How to Use This Dialog
                                </span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                                <div className="space-y-4 text-sm">
                                    {/* Step 1 */}
                                    <div className="flex gap-3">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                                            1
                                        </div>
                                        <div>
                                            <p className="font-semibold text-blue-800 dark:text-blue-300">Add Pay Rate Templates</p>
                                            <p className="mt-1 text-blue-700 dark:text-blue-400">
                                                Use the search box under "Add Template" to find templates from KeyPay. Click on a template to select
                                                it, then click the <span className="font-semibold">Add</span> button.
                                            </p>
                                            <div className="mt-2 rounded bg-blue-100 p-2 text-xs dark:bg-blue-900/40">
                                                <span className="font-medium">Tip:</span> Common templates include "CW3 - Carpenter", "CW1 -
                                                Labourer", "Foreman", etc.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="flex gap-3">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                                            2
                                        </div>
                                        <div>
                                            <p className="font-semibold text-blue-800 dark:text-blue-300">Configure Each Template</p>
                                            <p className="mt-1 text-blue-700 dark:text-blue-400">For each configured template, you can:</p>
                                            <ul className="mt-2 list-inside list-disc space-y-1 text-blue-700 dark:text-blue-400">
                                                <li>
                                                    <Pencil className="mr-1 inline h-3 w-3" /> <span className="font-medium">Edit label</span> - Click
                                                    the pencil icon to give a custom name
                                                </li>
                                                <li>
                                                    <span className="font-medium">Set Cost Code</span> - Click the cost code button to assign a prefix
                                                    (e.g., "03" for 03-01)
                                                </li>
                                                <li>
                                                    <span className="font-medium">Toggle Overtime</span> - Enable to show overtime hours row in the
                                                    forecast grid
                                                </li>
                                                <li>
                                                    <span className="font-medium">Leave Markups Job Costed</span> - Enable if leave accruals are charged
                                                    to the job, disable if they are absorbed as company overhead
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="flex gap-3">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                                            3
                                        </div>
                                        <div>
                                            <p className="font-semibold text-blue-800 dark:text-blue-300">Add Allowances</p>
                                            <p className="mt-1 text-blue-700 dark:text-blue-400">
                                                Click the <Plus className="mx-1 inline h-3 w-3 text-green-600" /> (green plus) icon to configure
                                                allowances for a template:
                                            </p>
                                            <ul className="mt-2 list-inside list-disc space-y-1 text-blue-700 dark:text-blue-400">
                                                <li>
                                                    <span className="font-medium">Fares & Travel</span> - Daily travel allowance
                                                </li>
                                                <li>
                                                    <span className="font-medium">Site Allowance</span> - Hourly site allowance based on project value
                                                </li>
                                                <li>
                                                    <span className="font-medium">Multistorey</span> - Height allowance for multi-level buildings
                                                </li>
                                                <li>
                                                    <span className="font-medium">Custom</span> - Any additional allowances
                                                </li>
                                            </ul>
                                            <div className="mt-2 rounded bg-blue-100 p-2 text-xs dark:bg-blue-900/40">
                                                <span className="font-medium">Note:</span> Each allowance shows a green badge when configured. Hover
                                                over badges to see rates.
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step 4 */}
                                    <div className="flex gap-3">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                                            4
                                        </div>
                                        <div>
                                            <p className="font-semibold text-blue-800 dark:text-blue-300">View Cost Breakdown</p>
                                            <p className="mt-1 text-blue-700 dark:text-blue-400">
                                                Click the <Calculator className="mx-1 inline h-3 w-3 text-indigo-600" /> (calculator) icon to see a
                                                detailed breakdown of how the weekly cost is calculated, including base wages, allowances, leave
                                                markups, and oncosts.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Icon Legend */}
                                    <div className="rounded-lg border border-blue-300 bg-white p-3 dark:border-blue-700 dark:bg-blue-950/50">
                                        <p className="mb-2 text-xs font-semibold text-blue-800 dark:text-blue-300">Icon Reference:</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-2">
                                                <Calculator className="h-4 w-4 text-indigo-500" />
                                                <span className="text-blue-700 dark:text-blue-400">View cost breakdown</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Plus className="h-4 w-4 text-green-500" />
                                                <span className="text-blue-700 dark:text-blue-400">Configure allowances</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Pencil className="h-4 w-4 text-slate-500" />
                                                <span className="text-blue-700 dark:text-blue-400">Edit template label</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                <span className="text-blue-700 dark:text-blue-400">Remove template</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

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
                                {availableTemplates.filter(
                                    (t) => t.hourly_rate && t.hourly_rate > 0 && t.name.toLowerCase().includes(templateSearch.toLowerCase()),
                                ).length === 0 ? (
                                    <div className="p-3 text-center text-sm text-slate-500">No templates found.</div>
                                ) : (
                                    availableTemplates
                                        .filter(
                                            (t) => t.hourly_rate && t.hourly_rate > 0 && t.name.toLowerCase().includes(templateSearch.toLowerCase()),
                                        )
                                        .map((template) => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                                    newTemplateId === String(template.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                                                }`}
                                                onClick={() => {
                                                    setNewTemplateId(String(template.id));
                                                    setTemplateSearch(template.name);
                                                }}
                                            >
                                                <Check
                                                    className={`h-4 w-4 shrink-0 text-blue-600 ${
                                                        newTemplateId === String(template.id) ? 'opacity-100' : 'opacity-0'
                                                    }`}
                                                />
                                                <span className="flex-1 text-left font-medium">{template.name}</span>
                                                <span className="shrink-0 rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                                    {formatCurrency(template.hourly_rate)}/hr
                                                </span>
                                            </button>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Configured templates list */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-medium">Configured Templates ({configuredTemplates.length})</h3>
                        {configuredTemplates.length === 0 ? (
                            <p className="text-sm text-slate-500">No templates configured. Add templates above to get started.</p>
                        ) : (
                            <div className="space-y-3">
                                {configuredTemplates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                                    >
                                        {/* Header Row - Name and Actions */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                {editingLabel?.id === template.id ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Input
                                                            value={editingLabel.label}
                                                            onChange={(e) => setEditingLabel({ ...editingLabel, label: e.target.value })}
                                                            placeholder="Custom label"
                                                            className="h-8 min-w-[120px] flex-1"
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
                                                    <div>
                                                        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                                            {template.label}
                                                        </h4>
                                                        {template.label !== template.name && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{template.name}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons - Always visible on right */}
                                            {!editingLabel && !editingCostCode && (
                                                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-700">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                                                                onClick={() => onOpenCostBreakdown(template)}
                                                            >
                                                                <Calculator className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>View cost breakdown</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 text-green-500 hover:bg-green-50 hover:text-green-700"
                                                                onClick={() => onOpenAllowanceDialog(template)}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Configure allowances</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                                                onClick={() => setEditingLabel({ id: template.id, label: template.label })}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit label</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                                onClick={() => handleRemoveTemplate(template.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Remove template</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            )}
                                        </div>

                                        {/* Rate & Cost Badges - Separate row for better mobile layout */}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <div className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-700">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Rate: </span>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                    {formatCurrency(template.hourly_rate)}/hr
                                                </span>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="cursor-help rounded-md bg-green-50 px-2 py-1 dark:bg-green-900/30">
                                                        <span className="text-xs text-green-600 dark:text-green-400">Weekly: </span>
                                                        <span className="text-sm font-bold text-green-700 dark:text-green-300">
                                                            {formatCurrency(template.cost_breakdown.total_weekly_cost)}
                                                        </span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" className="max-w-xs">
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between gap-4">
                                                            <span>Base Wages ({template.cost_breakdown.hours_per_week}hrs)</span>
                                                            <span className="font-medium">
                                                                {formatCurrency(template.cost_breakdown.base_weekly_wages)}
                                                            </span>
                                                        </div>
                                                        {template.cost_breakdown.allowances.total > 0 && (
                                                            <div className="flex justify-between gap-4">
                                                                <span>+ Allowances</span>
                                                                <span className="font-medium">
                                                                    {formatCurrency(template.cost_breakdown.allowances.total)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between gap-4">
                                                            <span>+ Leave Accruals</span>
                                                            <span className="font-medium">
                                                                {formatCurrency(
                                                                    template.cost_breakdown.leave_markups.annual_leave_amount +
                                                                        template.cost_breakdown.leave_markups.leave_loading_amount,
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span>+ Super</span>
                                                            <span className="font-medium">{formatCurrency(template.cost_breakdown.super)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span>+ On-Costs</span>
                                                            <span className="font-medium">
                                                                {formatCurrency(template.cost_breakdown.on_costs.total)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-600 pt-1 font-semibold text-green-400">
                                                            <span>Total Weekly Cost</span>
                                                            <span>{formatCurrency(template.cost_breakdown.total_weekly_cost)}</span>
                                                        </div>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>

                                        {/* Allowances Row */}
                                        {template.custom_allowances && template.custom_allowances.length > 0 && (
                                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Allowances:</span>
                                                {template.custom_allowances.map((allowance) => (
                                                    <Tooltip key={allowance.id}>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                                                {allowance.name}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>
                                                                {formatCurrency(allowance.rate)}/{allowance.rate_type} ={' '}
                                                                {formatCurrency(allowance.weekly_cost)}/week
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                        )}

                                        {/* Settings - Cost Code & Toggles */}
                                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                                            {/* Cost Code */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">
                                                    Cost Code:
                                                </span>
                                                {editingCostCode?.id === template.id ? (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <Input
                                                            value={editingCostCode.costCodePrefix}
                                                            onChange={(e) =>
                                                                setEditingCostCode({ ...editingCostCode, costCodePrefix: e.target.value })
                                                            }
                                                            placeholder="e.g., 03"
                                                            className="h-7 w-16 text-xs"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleUpdateCostCode();
                                                                if (e.key === 'Escape') setEditingCostCode(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button size="sm" className="h-7 px-2 text-xs" onClick={handleUpdateCostCode}>
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => setEditingCostCode(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            setEditingCostCode({ id: template.id, costCodePrefix: template.cost_code_prefix || '' })
                                                        }
                                                        className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                                    >
                                                        {template.cost_code_prefix ? `${template.cost_code_prefix}-01` : 'Set'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Overtime Toggle */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium whitespace-nowrap text-slate-500 dark:text-slate-400">
                                                    Overtime:
                                                </span>
                                                <Switch
                                                    checked={template.overtime_enabled}
                                                    onCheckedChange={(checked) => handleToggleOvertime(template.id, checked)}
                                                    className="data-[state=checked]:bg-orange-500"
                                                />
                                                <span
                                                    className={`text-xs font-medium ${template.overtime_enabled ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}
                                                >
                                                    {template.overtime_enabled ? 'On' : 'Off'}
                                                </span>
                                            </div>

                                            {/* Leave Markups Job Costed Toggle */}
                                            <div className="flex items-center gap-2">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="cursor-help text-xs font-medium whitespace-nowrap text-slate-500 underline decoration-dotted underline-offset-2 dark:text-slate-400">
                                                            Leave Markups:
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-xs">
                                                        <p className="text-xs font-medium mb-1">Controls whether leave markups (annual leave accrual + leave loading) are charged to the job.</p>
                                                        <p className="text-xs mb-1"><span className="font-medium">Enable</span> if leave accrual costs should be charged directly to the job. This adds annual leave and leave loading markups to the job cost.</p>
                                                        <p className="text-xs"><span className="font-medium">Disable</span> (default) if leave accruals are absorbed as overhead. Only oncosts (workers comp, payroll tax, super) will be job costed for leave hours.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Switch
                                                    checked={template.leave_markups_job_costed}
                                                    onCheckedChange={(checked) => handleToggleLeaveMarkupsJobCosted(template.id, checked)}
                                                    className="data-[state=checked]:bg-blue-500"
                                                />
                                                <span
                                                    className={`text-xs font-medium ${template.leave_markups_job_costed ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
                                                >
                                                    {template.leave_markups_job_costed ? 'On' : 'Off'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-slate-500">
                        Templates are sourced from KeyPay Pay Rate Templates. Hourly rates are based on the "Permanent Ordinary Hours" pay category.
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
                            <p className="mt-2 text-xs text-slate-500">These shift conditions affect allowance calculations in job costing.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
