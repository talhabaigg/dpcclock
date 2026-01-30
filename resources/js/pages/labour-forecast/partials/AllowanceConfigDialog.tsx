/**
 * Allowance Configuration Dialog
 *
 * PURPOSE:
 * Allows adding and configuring custom allowances for a pay rate template.
 * Custom allowances are job-specific additions beyond the standard allowances.
 *
 * FEATURES:
 * - Add allowances from a predefined list of allowance types
 * - Configure rate and rate type (hourly/daily/weekly) for each allowance
 * - Configure whether each allowance is paid during RDO hours
 * - Configure RDO payment for standard allowances (Fares/Travel, Site, Multistorey)
 * - Real-time weekly cost calculation display
 *
 * PARENT COMPONENT: show.tsx (via SettingsDialog)
 *
 * PROPS:
 * - open: boolean - Controls dialog visibility
 * - onOpenChange: (open: boolean) => void - Callback when dialog state changes
 * - template: The template being configured
 * - allowanceTypes: Available allowance types to choose from
 * - locationId: Location ID for API calls
 */

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { Check, Info, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AllowanceConfigItem, AllowanceType, ConfiguredTemplate } from '../types';
import { calculateAllowanceWeeklyCost, formatCurrency } from './utils';

interface AllowanceConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: ConfiguredTemplate | null;
    allowanceTypes: AllowanceType[];
    locationId: number;
}

export const AllowanceConfigDialog = ({
    open,
    onOpenChange,
    template,
    allowanceTypes,
    locationId,
}: AllowanceConfigDialogProps) => {
    // Local state
    const [allowanceConfig, setAllowanceConfig] = useState<AllowanceConfigItem[]>([]);
    const [rdoFaresTravel, setRdoFaresTravel] = useState(true);
    const [rdoSiteAllowance, setRdoSiteAllowance] = useState(false);
    const [rdoMultistoreyAllowance, setRdoMultistoreyAllowance] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize state when template changes
    useEffect(() => {
        if (template) {
            setAllowanceConfig(
                (template.custom_allowances || []).map((a) => ({
                    allowance_type_id: a.allowance_type_id,
                    rate: a.rate,
                    rate_type: a.rate_type,
                    paid_to_rdo: a.paid_to_rdo,
                }))
            );
            setRdoFaresTravel(template.rdo_fares_travel ?? true);
            setRdoSiteAllowance(template.rdo_site_allowance ?? false);
            setRdoMultistoreyAllowance(template.rdo_multistorey_allowance ?? false);
        }
    }, [template]);

    // Get allowances that can still be added
    const availableAllowancesToAdd = useMemo(() => {
        const configuredIds = allowanceConfig.map((a) => a.allowance_type_id);
        return allowanceTypes.filter((t) => !configuredIds.includes(t.id));
    }, [allowanceTypes, allowanceConfig]);

    // Handlers
    const handleAddAllowance = (allowanceTypeId: number) => {
        const allowanceType = allowanceTypes.find((t) => t.id === allowanceTypeId);
        if (!allowanceType) return;
        setAllowanceConfig((prev) => [
            ...prev,
            {
                allowance_type_id: allowanceTypeId,
                rate: allowanceType.default_rate || 0,
                rate_type: 'hourly' as const,
                paid_to_rdo: false,
            },
        ]);
    };

    const handleRemoveAllowance = (allowanceTypeId: number) => {
        setAllowanceConfig((prev) => prev.filter((a) => a.allowance_type_id !== allowanceTypeId));
    };

    const handleUpdateAllowanceRate = (allowanceTypeId: number, rate: number) => {
        setAllowanceConfig((prev) =>
            prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, rate } : a))
        );
    };

    const handleUpdateAllowanceRateType = (allowanceTypeId: number, rate_type: 'hourly' | 'daily' | 'weekly') => {
        setAllowanceConfig((prev) =>
            prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, rate_type } : a))
        );
    };

    const handleUpdateAllowancePaidToRdo = (allowanceTypeId: number, paid_to_rdo: boolean) => {
        setAllowanceConfig((prev) =>
            prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, paid_to_rdo } : a))
        );
    };

    const handleSave = () => {
        if (!template || isSaving) return;
        setIsSaving(true);
        router.put(
            route('labour-forecast.update-template-allowances', {
                location: locationId,
                template: template.id,
            }),
            {
                allowances: allowanceConfig,
                rdo_fares_travel: rdoFaresTravel,
                rdo_site_allowance: rdoSiteAllowance,
                rdo_multistorey_allowance: rdoMultistoreyAllowance,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSaving(false);
                    onOpenChange(false);
                },
                onError: () => setIsSaving(false),
            }
        );
    };

    if (!template) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Configure Allowances - {template.label}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Base template info */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium">{template.name}</h3>
                                <p className="text-sm text-slate-500">
                                    Base Rate: {formatCurrency(template.hourly_rate)}/hr
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-500">Base Weekly Cost</p>
                                <p className="text-lg font-semibold text-green-600">
                                    {formatCurrency(template.cost_breakdown.base_weekly_wages)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Add Allowance */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-medium">Add Allowance</h3>
                        <div className="flex gap-2">
                            <Select
                                value=""
                                onValueChange={(value) => handleAddAllowance(Number(value))}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select an allowance to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableAllowancesToAdd.length === 0 ? (
                                        <SelectItem value="none" disabled>
                                            All allowances added
                                        </SelectItem>
                                    ) : (
                                        availableAllowancesToAdd.map((type) => (
                                            <SelectItem key={type.id} value={String(type.id)}>
                                                {type.name}
                                                {type.default_rate && ` (${formatCurrency(type.default_rate)}/hr default)`}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Select allowances to apply to this template for this job.
                        </p>
                    </div>

                    {/* RDO Standard Allowances Configuration */}
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                        <h3 className="mb-3 text-sm font-medium text-purple-700 dark:text-purple-400">
                            RDO (Rostered Days Off) Allowances
                        </h3>
                        <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                            Configure which standard allowances are paid during RDO hours. Custom allowances can be configured individually below.
                        </p>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="rdo-fares-travel"
                                    checked={rdoFaresTravel}
                                    onCheckedChange={(checked) => setRdoFaresTravel(checked as boolean)}
                                />
                                <label
                                    htmlFor="rdo-fares-travel"
                                    className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                    Pay Fares/Travel allowance during RDO
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="rdo-site"
                                    checked={rdoSiteAllowance}
                                    onCheckedChange={(checked) => setRdoSiteAllowance(checked as boolean)}
                                />
                                <label
                                    htmlFor="rdo-site"
                                    className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                    Pay Site allowance during RDO
                                </label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="rdo-multistorey"
                                    checked={rdoMultistoreyAllowance}
                                    onCheckedChange={(checked) => setRdoMultistoreyAllowance(checked as boolean)}
                                />
                                <label
                                    htmlFor="rdo-multistorey"
                                    className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                    Pay Multistorey allowance during RDO
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Configured Allowances */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-medium">Active Allowances</h3>
                        {allowanceConfig.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                No allowances configured. Add allowances above to customize this template.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {allowanceConfig.map((config) => {
                                    const allowanceType = allowanceTypes.find((t) => t.id === config.allowance_type_id);
                                    if (!allowanceType) return null;

                                    const weeklyCost = calculateAllowanceWeeklyCost(config.rate, config.rate_type);

                                    return (
                                        <div
                                            key={config.allowance_type_id}
                                            className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <div className="font-medium">{allowanceType.name}</div>
                                                    {allowanceType.description && (
                                                        <div className="text-xs text-slate-500">{allowanceType.description}</div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm text-slate-500">$</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={config.rate}
                                                            onChange={(e) =>
                                                                handleUpdateAllowanceRate(
                                                                    config.allowance_type_id,
                                                                    parseFloat(e.target.value) || 0
                                                                )
                                                            }
                                                            className="h-8 w-20 text-right"
                                                        />
                                                    </div>

                                                    <Select
                                                        value={config.rate_type}
                                                        onValueChange={(value) =>
                                                            handleUpdateAllowanceRateType(
                                                                config.allowance_type_id,
                                                                value as 'hourly' | 'daily' | 'weekly'
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 w-24">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="hourly">/hour</SelectItem>
                                                            <SelectItem value="daily">/day</SelectItem>
                                                            <SelectItem value="weekly">/week</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                                {formatCurrency(weeklyCost)}/wk
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            Weekly cost: {formatCurrency(config.rate)} x {config.rate_type === 'hourly' ? '40 hrs' : config.rate_type === 'daily' ? '5 days' : '1'}
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveAllowance(config.allowance_type_id)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* RDO Option */}
                                            <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                                                <Checkbox
                                                    id={`rdo-${config.allowance_type_id}`}
                                                    checked={config.paid_to_rdo}
                                                    onCheckedChange={(checked) =>
                                                        handleUpdateAllowancePaidToRdo(
                                                            config.allowance_type_id,
                                                            checked as boolean
                                                        )
                                                    }
                                                />
                                                <label
                                                    htmlFor={`rdo-${config.allowance_type_id}`}
                                                    className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                                                >
                                                    Pay this allowance during RDO hours
                                                </label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-4 w-4 text-slate-400" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs">
                                                        <p className="text-xs">
                                                            When enabled, this allowance will be included when calculating costs for RDO (Rostered Days Off) hours.
                                                            Fares/Travel allowances are always paid during RDO.
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Total Impact */}
                    {allowanceConfig.length > 0 && (
                        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">Total Custom Allowances</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {allowanceConfig.length} allowance{allowanceConfig.length !== 1 ? 's' : ''} configured
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        +{formatCurrency(
                                            allowanceConfig.reduce((sum, config) => {
                                                return sum + calculateAllowanceWeeklyCost(config.rate, config.rate_type);
                                            }, 0)
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">per worker per week</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Save Allowances
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
