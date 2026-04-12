/**
 * Settings Dialog Component
 *
 * PURPOSE:
 * Manages pay rate template configuration for a location/job.
 * Uses a sidebar layout: left panel lists configured templates,
 * right panel shows detail/settings for the selected template.
 *
 * FEATURES:
 * - Search and add pay rate templates from KeyPay
 * - Customize template labels and cost code prefixes
 * - Toggle overtime tracking per template
 * - View cost breakdowns and configure allowances
 * - View active shift conditions
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { ArrowLeft, Calculator, Check, CheckCircle2, ChevronDown, Info, Pencil, Plus, Search, Settings, Trash2, XCircle } from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';
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
    onOpenAllowanceDialog: (template: ConfiguredTemplate) => void;
}

// Inline, collapsible cost breakdown for the selected template
const CostBreakdownSection = ({ template }: { template: ConfiguredTemplate }) => {
    const [open, setOpen] = useState(false);
    const breakdown = template.cost_breakdown;
    if (!breakdown) return null;

    const Row = ({ label, value, muted }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean }) => (
        <div className="flex justify-between text-sm">
            <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
        </div>
    );

    const SubTotalRow = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
        <div className="flex justify-between border-t pt-2 text-sm">
            <span className="font-medium">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
        </div>
    );

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Cost Breakdown
                    </span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-3 space-y-3">
                    {/* Base Wages */}
                    <div className="rounded-lg border p-3">
                        <h4 className="mb-2 text-sm font-medium">Base Wages</h4>
                        <div className="space-y-1.5">
                            <Row muted label="Hourly Rate" value={`${formatCurrency(breakdown.base_hourly_rate)}/hr`} />
                            <Row muted label="Hours Per Week" value={`${breakdown.hours_per_week} hrs`} />
                            <SubTotalRow label="Base Weekly Wages" value={formatCurrency(breakdown.base_weekly_wages)} />
                        </div>
                    </div>

                    {/* Allowances */}
                    <div className="rounded-lg border p-3">
                        <h4 className="mb-2 text-sm font-medium">Allowances</h4>
                        <div className="space-y-1.5">
                            {breakdown.allowances.fares_travel.name && (
                                <Row
                                    muted
                                    label={
                                        <>
                                            {breakdown.allowances.fares_travel.name}
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({formatCurrency(breakdown.allowances.fares_travel.rate)}/day × 5)
                                            </span>
                                        </>
                                    }
                                    value={formatCurrency(breakdown.allowances.fares_travel.weekly)}
                                />
                            )}
                            {breakdown.allowances.site.name && (
                                <Row
                                    muted
                                    label={
                                        <>
                                            {breakdown.allowances.site.name}
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({formatCurrency(breakdown.allowances.site.rate)}/hr × 40)
                                            </span>
                                        </>
                                    }
                                    value={formatCurrency(breakdown.allowances.site.weekly)}
                                />
                            )}
                            {breakdown.allowances.multistorey.name && (
                                <Row
                                    muted
                                    label={
                                        <>
                                            {breakdown.allowances.multistorey.name}
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                ({formatCurrency(breakdown.allowances.multistorey.rate)}/hr × 40)
                                            </span>
                                        </>
                                    }
                                    value={formatCurrency(breakdown.allowances.multistorey.weekly)}
                                />
                            )}
                            {breakdown.allowances.custom && breakdown.allowances.custom.length > 0 && (
                                <>
                                    {breakdown.allowances.custom.map((a) => (
                                        <Row
                                            key={a.type_id}
                                            muted
                                            label={
                                                <>
                                                    {a.name}
                                                    <span className="ml-1 text-xs text-muted-foreground">
                                                        ({formatCurrency(a.rate)}/
                                                        {a.rate_type === 'hourly' ? 'hr × 40' : a.rate_type === 'daily' ? 'day × 5' : 'week'})
                                                    </span>
                                                </>
                                            }
                                            value={formatCurrency(a.weekly)}
                                        />
                                    ))}
                                </>
                            )}
                            {breakdown.allowances.total === 0 && (
                                <p className="text-xs italic text-muted-foreground">No allowances applied.</p>
                            )}
                            <SubTotalRow label="Total Allowances" value={formatCurrency(breakdown.allowances.total)} />
                        </div>
                    </div>

                    {/* Gross Wages summary */}
                    <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium">Gross Wages (Base + Allowances)</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(breakdown.gross_wages)}</span>
                        </div>
                    </div>

                    {/* Leave Markups */}
                    <div className="rounded-lg border p-3">
                        <h4 className="mb-2 text-sm font-medium">Leave Accrual Markups</h4>
                        <div className="space-y-1.5">
                            <Row
                                muted
                                label={`Annual Leave (${breakdown.leave_markups.annual_leave_rate}%)`}
                                value={`+${formatCurrency(breakdown.leave_markups.annual_leave_amount)}`}
                            />
                            <Row
                                muted
                                label={`Leave Loading (${breakdown.leave_markups.leave_loading_rate}%)`}
                                value={`+${formatCurrency(breakdown.leave_markups.leave_loading_amount)}`}
                            />
                            <div className="flex items-center justify-between border-t pt-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Marked-Up Wages</span>
                                    {breakdown.cost_codes.wages && (
                                        <Badge variant="secondary" className="font-mono">
                                            {breakdown.cost_codes.wages}
                                        </Badge>
                                    )}
                                </div>
                                <span className="font-semibold tabular-nums">{formatCurrency(breakdown.marked_up_wages)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Super */}
                    <div className="rounded-lg border p-3">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>Superannuation (Fixed Weekly)</span>
                                <Badge variant="secondary" className="font-mono">
                                    {breakdown.cost_codes.super}
                                </Badge>
                            </div>
                            <span className="font-medium tabular-nums">{formatCurrency(breakdown.super)}</span>
                        </div>
                    </div>

                    {/* On-Costs */}
                    <div className="rounded-lg border p-3">
                        <h4 className="mb-2 text-sm font-medium">On-Costs</h4>
                        <div className="space-y-1.5">
                            {[
                                { key: 'bert', label: 'BERT (Building Industry Redundancy)', code: breakdown.cost_codes.bert, value: breakdown.on_costs.bert },
                                { key: 'bewt', label: 'BEWT (Building Employees Withholding Tax)', code: breakdown.cost_codes.bewt, value: breakdown.on_costs.bewt },
                                { key: 'cipq', label: 'CIPQ (Construction Induction)', code: breakdown.cost_codes.cipq, value: breakdown.on_costs.cipq },
                                {
                                    key: 'payroll',
                                    label: `Payroll Tax (${breakdown.on_costs.payroll_tax_rate}%)`,
                                    code: breakdown.cost_codes.payroll_tax,
                                    value: breakdown.on_costs.payroll_tax,
                                },
                                {
                                    key: 'workcover',
                                    label: `WorkCover (${breakdown.on_costs.workcover_rate}%)`,
                                    code: breakdown.cost_codes.workcover,
                                    value: breakdown.on_costs.workcover,
                                },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <span>{item.label}</span>
                                        <Badge variant="secondary" className="font-mono">
                                            {item.code}
                                        </Badge>
                                    </div>
                                    <span className="font-medium tabular-nums">{formatCurrency(item.value)}</span>
                                </div>
                            ))}
                            <SubTotalRow label="Total On-Costs" value={formatCurrency(breakdown.on_costs.total)} />
                        </div>
                    </div>

                    {/* Total */}
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-base font-semibold">Total Weekly Job Cost</span>
                            <span className="text-base font-bold tabular-nums">{formatCurrency(breakdown.total_weekly_cost)}</span>
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};

export const SettingsDialog = ({
    open,
    onOpenChange,
    configuredTemplates,
    availableTemplates,
    locationWorktypes,
    locationId,
    flash,
    onOpenAllowanceDialog,
}: SettingsDialogProps) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [editingLabel, setEditingLabel] = useState<{ id: number; label: string } | null>(null);
    const [editingCostCode, setEditingCostCode] = useState<{ id: number; costCodePrefix: string } | null>(null);
    const [newTemplateId, setNewTemplateId] = useState<string>('');
    const [templateSearch, setTemplateSearch] = useState('');
    const [showAddTemplate, setShowAddTemplate] = useState(false);
    // Mobile-only: track whether the detail pane is shown instead of the list
    const [mobileShowDetail, setMobileShowDetail] = useState(false);

    // Reset mobile view state when the dialog closes
    useEffect(() => {
        if (!open) setMobileShowDetail(false);
    }, [open]);

    // Auto-select first template when list changes
    useEffect(() => {
        if (configuredTemplates.length > 0) {
            const stillExists = configuredTemplates.find((t) => t.id === selectedTemplateId);
            if (!stillExists) {
                setSelectedTemplateId(configuredTemplates[0].id);
            }
        } else {
            setSelectedTemplateId(null);
        }
    }, [configuredTemplates]);

    const selectedTemplate = configuredTemplates.find((t) => t.id === selectedTemplateId) ?? null;

    const handleAddTemplate = () => {
        if (!newTemplateId) return;
        router.post(route('labour-forecast.add-template', { location: locationId }), { template_id: newTemplateId }, {
            preserveScroll: true,
            onSuccess: () => {
                setNewTemplateId('');
                setTemplateSearch('');
            },
        });
    };

    const handleRemoveTemplate = (configId: number) => {
        if (!confirm('Are you sure you want to remove this template?')) return;
        router.delete(route('labour-forecast.remove-template', { location: locationId, template: configId }), { preserveScroll: true });
    };

    const handleUpdateLabel = () => {
        if (!editingLabel) return;
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: editingLabel.id }),
            { label: editingLabel.label },
            { preserveScroll: true },
        );
        setEditingLabel(null);
    };

    const handleUpdateCostCode = () => {
        if (!editingCostCode) return;
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: editingCostCode.id }),
            { cost_code_prefix: editingCostCode.costCodePrefix },
            { preserveScroll: true },
        );
        setEditingCostCode(null);
    };

    const handleToggleOvertime = (templateId: number, enabled: boolean) => {
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: templateId }),
            { overtime_enabled: enabled },
            { preserveScroll: true },
        );
    };

    const handleToggleLeaveMarkupsJobCosted = (templateId: number, enabled: boolean) => {
        router.put(
            route('labour-forecast.update-template-label', { location: locationId, template: templateId }),
            { leave_markups_job_costed: enabled },
            { preserveScroll: true },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!flex !flex-col h-[95vh] max-h-[95vh] w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 sm:h-[85vh] sm:max-h-[85vh] sm:max-w-4xl lg:max-w-5xl">
                {/* Header */}
                <div className="shrink-0 px-4 pb-3 pt-5 sm:px-6 sm:pt-6 sm:pb-4">
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <DialogHeader className="flex-1 min-w-0">
                                <DialogTitle className="flex items-center gap-2 pr-8">
                                    <Settings className="h-5 w-5 shrink-0" />
                                    <span className="truncate">Configure Pay Rate Templates</span>
                                </DialogTitle>
                                <DialogDescription>
                                    Manage pay rate templates, allowances, and cost settings for this location.
                                </DialogDescription>
                            </DialogHeader>

                            <Popover
                                open={showAddTemplate}
                                onOpenChange={(open) => {
                                    setShowAddTemplate(open);
                                    if (!open) {
                                        setTemplateSearch('');
                                        setNewTemplateId('');
                                    }
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <Button size="sm" className="w-full sm:mr-6 sm:w-auto">
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        Add Template
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-3">
                                    <div className="space-y-2">
                                        <div>
                                            <h4 className="text-sm font-medium">Add Pay Rate Template</h4>
                                            <p className="text-xs text-muted-foreground">Search KeyPay templates to add to this location.</p>
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Search templates..."
                                                value={templateSearch}
                                                onChange={(e) => {
                                                    setTemplateSearch(e.target.value);
                                                    setNewTemplateId('');
                                                }}
                                                className="pl-8 h-9"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-[240px] overflow-y-auto rounded-md border">
                                            {availableTemplates.filter(
                                                (t) => t.hourly_rate && t.hourly_rate > 0 && t.name.toLowerCase().includes(templateSearch.toLowerCase()),
                                            ).length === 0 ? (
                                                <div className="p-3 text-center text-sm text-muted-foreground">No templates found.</div>
                                            ) : (
                                                availableTemplates
                                                    .filter(
                                                        (t) => t.hourly_rate && t.hourly_rate > 0 && t.name.toLowerCase().includes(templateSearch.toLowerCase()),
                                                    )
                                                    .map((template) => (
                                                        <button
                                                            key={template.id}
                                                            type="button"
                                                            className={cn(
                                                                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent',
                                                                newTemplateId === String(template.id) && 'bg-accent',
                                                            )}
                                                            onClick={() => {
                                                                setNewTemplateId(String(template.id));
                                                                setTemplateSearch(template.name);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    'h-4 w-4 shrink-0 text-primary',
                                                                    newTemplateId === String(template.id) ? 'opacity-100' : 'opacity-0',
                                                                )}
                                                            />
                                                            <span className="flex-1 text-left font-medium break-words">{template.name}</span>
                                                            <Badge variant="secondary" className="shrink-0 self-start">
                                                                {formatCurrency(template.hourly_rate)}/hr
                                                            </Badge>
                                                        </button>
                                                    ))
                                            )}
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setShowAddTemplate(false);
                                                    setTemplateSearch('');
                                                    setNewTemplateId('');
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={handleAddTemplate} disabled={!newTemplateId}>
                                                <Plus className="mr-1 h-4 w-4" />
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {flash?.success && (
                            <Alert className="mt-3">
                                <CheckCircle2 className="text-emerald-500" />
                                <AlertDescription>{flash.success}</AlertDescription>
                            </Alert>
                        )}
                        {flash?.error && (
                            <Alert variant="destructive" className="mt-3">
                                <XCircle />
                                <AlertDescription>{flash.error}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <Separator />

                    {/* Sidebar + Content */}
                    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                        {/* Sidebar */}
                        <div
                            className={cn(
                                'flex min-h-0 shrink-0 flex-col border-r md:w-64',
                                // Mobile: fill when list view, hide when detail view
                                mobileShowDetail ? 'hidden' : 'flex-1',
                                'md:flex md:flex-none',
                            )}
                        >
                            {/* Template list */}
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {configuredTemplates.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground">
                                        No templates configured. Click "Add Template" above.
                                    </div>
                                ) : (
                                    <div className="py-1">
                                        {configuredTemplates.map((template) => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTemplateId(template.id);
                                                    setEditingLabel(null);
                                                    setEditingCostCode(null);
                                                    setMobileShowDetail(true);
                                                }}
                                                className={cn(
                                                    'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-accent',
                                                    selectedTemplateId === template.id && 'md:bg-accent',
                                                )}
                                            >
                                                <span className="text-sm font-medium truncate w-full">{template.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatCurrency(template.hourly_rate)}/hr
                                                    {' \u00B7 '}
                                                    {formatCurrency(template.cost_breakdown.total_weekly_cost)}/wk
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Shift conditions footer */}
                            {locationWorktypes.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="p-3">
                                        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <Info className="h-3 w-3" />
                                            Shift Conditions
                                        </div>
                                        <ul className="space-y-0.5">
                                            {locationWorktypes.map((wt) => (
                                                <li key={wt.id} className="text-xs leading-snug text-muted-foreground break-words">
                                                    • {wt.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Detail panel */}
                        <div
                            className={cn(
                                'min-h-0 flex-1 overflow-y-auto',
                                // Mobile: hide when list view, show when detail view
                                !mobileShowDetail && 'hidden md:block',
                            )}
                        >
                            {!selectedTemplate ? (
                                <div className="hidden h-full items-center justify-center p-6 text-center text-sm text-muted-foreground md:flex">
                                    {configuredTemplates.length === 0
                                        ? 'Add a template to get started'
                                        : 'Select a template from the sidebar'}
                                </div>
                            ) : (
                                <div className="space-y-6 p-4 sm:p-6">
                                    {/* Mobile back button */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="-ml-2 md:hidden"
                                        onClick={() => setMobileShowDetail(false)}
                                    >
                                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                                        Back to list
                                    </Button>

                                    {/* Template header */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            {editingLabel?.id === selectedTemplate.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editingLabel.label}
                                                        onChange={(e) => setEditingLabel({ ...editingLabel, label: e.target.value })}
                                                        placeholder="Custom label"
                                                        className="h-9 flex-1"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdateLabel();
                                                            if (e.key === 'Escape') setEditingLabel(null);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <Button size="sm" onClick={handleUpdateLabel}>Save</Button>
                                                    <Button size="sm" variant="outline" onClick={() => setEditingLabel(null)}>Cancel</Button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-semibold">{selectedTemplate.label}</h3>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0"
                                                            onClick={() => setEditingLabel({ id: selectedTemplate.id, label: selectedTemplate.label })}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                    {selectedTemplate.label !== selectedTemplate.name && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">{selectedTemplate.name}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="shrink-0 text-destructive hover:text-destructive"
                                            onClick={() => handleRemoveTemplate(selectedTemplate.id)}
                                        >
                                            <Trash2 className="h-4 w-4 sm:mr-1.5" />
                                            <span className="hidden sm:inline">Remove</span>
                                        </Button>
                                    </div>

                                    {/* Rate info */}
                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                        <div className="rounded-lg border p-3">
                                            <p className="text-xs text-muted-foreground">Hourly Rate</p>
                                            <p className="text-lg font-semibold">{formatCurrency(selectedTemplate.hourly_rate)}</p>
                                        </div>
                                        <div className="rounded-lg border p-3">
                                            <p className="text-xs text-muted-foreground">Allowances</p>
                                            <p className="text-lg font-semibold">{formatCurrency(selectedTemplate.cost_breakdown.allowances.total)}</p>
                                        </div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="rounded-lg border p-3 cursor-help">
                                                    <p className="text-xs text-muted-foreground">Total Weekly</p>
                                                    <p className="text-lg font-semibold">{formatCurrency(selectedTemplate.cost_breakdown.total_weekly_cost)}</p>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="max-w-xs">
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between gap-4">
                                                        <span>Base Wages ({selectedTemplate.cost_breakdown.hours_per_week}hrs)</span>
                                                        <span className="font-medium">{formatCurrency(selectedTemplate.cost_breakdown.base_weekly_wages)}</span>
                                                    </div>
                                                    {selectedTemplate.cost_breakdown.allowances.total > 0 && (
                                                        <div className="flex justify-between gap-4">
                                                            <span>+ Allowances</span>
                                                            <span className="font-medium">{formatCurrency(selectedTemplate.cost_breakdown.allowances.total)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between gap-4">
                                                        <span>+ Leave Accruals</span>
                                                        <span className="font-medium">
                                                            {formatCurrency(
                                                                selectedTemplate.cost_breakdown.leave_markups.annual_leave_amount +
                                                                    selectedTemplate.cost_breakdown.leave_markups.leave_loading_amount,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span>+ Super</span>
                                                        <span className="font-medium">{formatCurrency(selectedTemplate.cost_breakdown.super)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span>+ On-Costs</span>
                                                        <span className="font-medium">{formatCurrency(selectedTemplate.cost_breakdown.on_costs.total)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
                                                        <span>Total Weekly Cost</span>
                                                        <span>{formatCurrency(selectedTemplate.cost_breakdown.total_weekly_cost)}</span>
                                                    </div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                        <div className="rounded-lg border p-3">
                                            <p className="text-xs text-muted-foreground">Hours/Week</p>
                                            <p className="text-lg font-semibold">{selectedTemplate.cost_breakdown.hours_per_week}</p>
                                        </div>
                                    </div>

                                    {/* Actions row */}
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => onOpenAllowanceDialog(selectedTemplate)}>
                                            <Plus className="mr-1.5 h-4 w-4" />
                                            Configure Allowances
                                        </Button>
                                    </div>

                                    <Separator />

                                    {/* Allowances */}
                                    {selectedTemplate.custom_allowances && selectedTemplate.custom_allowances.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium mb-2">Allowances</h4>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedTemplate.custom_allowances.map((allowance) => (
                                                    <Tooltip key={allowance.id}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <Badge variant="secondary" className="cursor-help">
                                                                    {allowance.name}
                                                                </Badge>
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
                                        </div>
                                    )}

                                    {/* Settings */}
                                    <div>
                                        <h4 className="text-sm font-medium mb-3">Settings</h4>
                                        <div className="space-y-4">
                                            {/* Cost Code */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm">Cost Code Prefix</p>
                                                    <p className="text-xs text-muted-foreground">Sets the cost code prefix for this template (e.g., "03" for 03-01)</p>
                                                </div>
                                                {editingCostCode?.id === selectedTemplate.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            value={editingCostCode.costCodePrefix}
                                                            onChange={(e) =>
                                                                setEditingCostCode({ ...editingCostCode, costCodePrefix: e.target.value })
                                                            }
                                                            placeholder="e.g., 03"
                                                            className="h-8 w-20 text-sm"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleUpdateCostCode();
                                                                if (e.key === 'Escape') setEditingCostCode(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button size="sm" className="h-8" onClick={handleUpdateCostCode}>Save</Button>
                                                        <Button size="sm" variant="outline" className="h-8" onClick={() => setEditingCostCode(null)}>Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            setEditingCostCode({ id: selectedTemplate.id, costCodePrefix: selectedTemplate.cost_code_prefix || '' })
                                                        }
                                                        className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm font-medium transition-colors hover:bg-muted/80"
                                                    >
                                                        {selectedTemplate.cost_code_prefix ? `${selectedTemplate.cost_code_prefix}-01` : 'Set'}
                                                    </button>
                                                )}
                                            </div>

                                            <Separator />

                                            {/* Overtime Toggle */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm">Overtime</p>
                                                    <p className="text-xs text-muted-foreground">Show overtime hours row in the forecast grid</p>
                                                </div>
                                                <Switch
                                                    checked={selectedTemplate.overtime_enabled}
                                                    onCheckedChange={(checked) => handleToggleOvertime(selectedTemplate.id, checked)}
                                                />
                                            </div>

                                            <Separator />

                                            {/* Leave Markups Toggle */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm">Leave Markups Job Costed</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Charge leave accrual costs (annual leave + leave loading) directly to the job
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={selectedTemplate.leave_markups_job_costed}
                                                    onCheckedChange={(checked) => handleToggleLeaveMarkupsJobCosted(selectedTemplate.id, checked)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cost Breakdown - Collapsible */}
                                    <CostBreakdownSection template={selectedTemplate} />

                                    {/* Footer note */}
                                    <p className="text-xs text-muted-foreground">
                                        Templates are sourced from KeyPay. Hourly rates are based on the "Permanent Ordinary Hours" pay category.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
            </DialogContent>
        </Dialog>
    );
};
