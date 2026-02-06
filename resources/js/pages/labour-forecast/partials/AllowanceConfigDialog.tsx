/**
 * Allowance Configuration Dialog
 *
 * PURPOSE:
 * Allows adding and configuring all allowances for a pay rate template.
 * Supports standard allowances (Fares/Travel, Site, Multistorey) and custom allowances.
 *
 * FEATURES:
 * - Add allowances from a predefined list of allowance types grouped by category
 * - Configure rate and rate type (hourly/daily/weekly) for each allowance
 * - Configure whether each allowance is paid during RDO hours
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { Check, Info, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AllowanceType, ConfiguredTemplate } from '../types';
import { calculateAllowanceWeeklyCost, formatCurrency } from './utils';

// Local type that allows empty rate_type for new allowances before user selects
type LocalAllowanceConfigItem = {
    allowance_type_id: number;
    rate: number;
    rate_type: 'hourly' | 'daily' | 'weekly' | '';
    paid_to_rdo: boolean;
};

interface AllowanceConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: ConfiguredTemplate | null;
    allowanceTypes: AllowanceType[];
    locationId: number;
}

// Category display names and colors
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    fares_travel: {
        label: 'Fares & Travel',
        color: 'text-blue-700 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    },
    site: {
        label: 'Site Allowance',
        color: 'text-amber-700 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    },
    multistorey: {
        label: 'Multi-storey',
        color: 'text-purple-700 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    },
    custom: {
        label: 'Other Allowances',
        color: 'text-slate-700 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    },
};

export const AllowanceConfigDialog = ({ open, onOpenChange, template, allowanceTypes, locationId }: AllowanceConfigDialogProps) => {
    // Local state
    const [allowanceConfig, setAllowanceConfig] = useState<LocalAllowanceConfigItem[]>([]);
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
                })),
            );
        }
    }, [template]);

    // Group allowance types by category
    const allowancesByCategory = useMemo(() => {
        const configuredIds = allowanceConfig.map((a) => a.allowance_type_id);
        const available = allowanceTypes.filter((t) => !configuredIds.includes(t.id));

        const grouped: Record<string, AllowanceType[]> = {
            fares_travel: [],
            site: [],
            multistorey: [],
            custom: [],
        };

        available.forEach((type) => {
            const category = type.category || 'custom';
            if (grouped[category]) {
                grouped[category].push(type);
            } else {
                grouped.custom.push(type);
            }
        });

        return grouped;
    }, [allowanceTypes, allowanceConfig]);

    // Group configured allowances by category
    const configuredByCategory = useMemo(() => {
        const grouped: Record<string, Array<LocalAllowanceConfigItem & { allowanceType: AllowanceType }>> = {
            fares_travel: [],
            site: [],
            multistorey: [],
            custom: [],
        };

        allowanceConfig.forEach((config) => {
            const allowanceType = allowanceTypes.find((t) => t.id === config.allowance_type_id);
            if (!allowanceType) return;

            const category = allowanceType.category || 'custom';
            if (grouped[category]) {
                grouped[category].push({ ...config, allowanceType });
            } else {
                grouped.custom.push({ ...config, allowanceType });
            }
        });

        return grouped;
    }, [allowanceConfig, allowanceTypes]);

    // Check if any allowances are available to add
    const hasAvailableAllowances = useMemo(() => {
        return Object.values(allowancesByCategory).some((arr) => arr.length > 0);
    }, [allowancesByCategory]);

    // Check if any allowances are incomplete (missing rate_type)
    const hasIncompleteAllowances = useMemo(() => {
        return allowanceConfig.some((a) => !a.rate_type);
    }, [allowanceConfig]);

    // Handlers
    const handleAddAllowance = (allowanceTypeId: number) => {
        const allowanceType = allowanceTypes.find((t) => t.id === allowanceTypeId);
        if (!allowanceType) return;

        // Fares/travel allowances default to paid_to_rdo = true
        const defaultPaidToRdo = allowanceType.category === 'fares_travel';

        setAllowanceConfig((prev) => [
            ...prev,
            {
                allowance_type_id: allowanceTypeId,
                rate: allowanceType.default_rate || 0,
                rate_type: '', // Require user to select rate type
                paid_to_rdo: defaultPaidToRdo,
            },
        ]);
    };

    const handleRemoveAllowance = (allowanceTypeId: number) => {
        setAllowanceConfig((prev) => prev.filter((a) => a.allowance_type_id !== allowanceTypeId));
    };

    const handleUpdateAllowanceRate = (allowanceTypeId: number, rate: number) => {
        setAllowanceConfig((prev) => prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, rate } : a)));
    };

    const handleUpdateAllowanceRateType = (allowanceTypeId: number, rate_type: 'hourly' | 'daily' | 'weekly' | '') => {
        setAllowanceConfig((prev) => prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, rate_type } : a)));
    };

    const handleUpdateAllowancePaidToRdo = (allowanceTypeId: number, paid_to_rdo: boolean) => {
        setAllowanceConfig((prev) => prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, paid_to_rdo } : a)));
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
                allowances: allowanceConfig as any,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSaving(false);
                    onOpenChange(false);
                },
                onError: () => setIsSaving(false),
            },
        );
    };

    if (!template) return null;

    const renderAllowanceItem = (config: LocalAllowanceConfigItem & { allowanceType: AllowanceType }) => {
        const weeklyCost = config.rate_type ? calculateAllowanceWeeklyCost(config.rate, config.rate_type as 'hourly' | 'daily' | 'weekly') : null;

        return (
            <div key={config.allowance_type_id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                {/* Header row - Name and Remove button */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="font-medium">{config.allowanceType.name}</div>
                        {config.allowanceType.description && <div className="text-xs text-slate-500">{config.allowanceType.description}</div>}
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveAllowance(config.allowance_type_id)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Rate controls - responsive row */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <span className="text-sm text-slate-500">$</span>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={config.rate}
                            onChange={(e) => handleUpdateAllowanceRate(config.allowance_type_id, parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-right"
                        />
                    </div>

                    <Select
                        value={config.rate_type || undefined}
                        onValueChange={(value) => handleUpdateAllowanceRateType(config.allowance_type_id, value as 'hourly' | 'daily' | 'weekly')}
                    >
                        <SelectTrigger className={`h-8 w-28 ${!config.rate_type ? 'border-amber-400 dark:border-amber-600' : ''}`}>
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hourly">/hour</SelectItem>
                            <SelectItem value="daily">/day</SelectItem>
                            <SelectItem value="weekly">/week</SelectItem>
                        </SelectContent>
                    </Select>

                    {weeklyCost !== null ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    {formatCurrency(weeklyCost)}/wk
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                Weekly cost: {formatCurrency(config.rate)} x{' '}
                                {config.rate_type === 'hourly' ? '40 hrs' : config.rate_type === 'daily' ? '5 days' : '1'}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="rounded bg-amber-100 px-2 py-1 text-sm font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            Select rate type
                        </div>
                    )}
                </div>

                {/* RDO Option */}
                <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <Checkbox
                        id={`rdo-${config.allowance_type_id}`}
                        checked={config.paid_to_rdo}
                        onCheckedChange={(checked) => handleUpdateAllowancePaidToRdo(config.allowance_type_id, checked as boolean)}
                    />
                    <label htmlFor={`rdo-${config.allowance_type_id}`} className="cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                        Pay during RDO hours
                    </label>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                            <p className="text-xs">
                                When enabled, this allowance will be included when calculating costs for RDO (Rostered Days Off) hours.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] min-w-[95vw] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 shrink-0" />
                        <span className="truncate">Configure Allowances - {template.label}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Base template info */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <h3 className="truncate font-medium">{template.name}</h3>
                                <p className="text-sm text-slate-500">Base Rate: {formatCurrency(template.hourly_rate)}/hr</p>
                            </div>
                            <div className="sm:text-right">
                                <p className="text-sm text-slate-500">Base Weekly Cost</p>
                                <p className="text-lg font-semibold text-green-600">{formatCurrency(template.cost_breakdown.base_weekly_wages)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Add Allowance - Grouped by Category */}
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                        <h3 className="mb-3 text-sm font-medium">Add Allowance</h3>
                        <div className="flex gap-2">
                            <Select value="" onValueChange={(value) => handleAddAllowance(Number(value))}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select an allowance to add..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {!hasAvailableAllowances ? (
                                        <SelectItem value="none" disabled>
                                            All allowances added
                                        </SelectItem>
                                    ) : (
                                        <>
                                            {allowancesByCategory.fares_travel.length > 0 && (
                                                <SelectGroup>
                                                    <SelectLabel className="text-blue-700 dark:text-blue-400">Fares & Travel</SelectLabel>
                                                    {allowancesByCategory.fares_travel.map((type) => (
                                                        <SelectItem key={type.id} value={String(type.id)}>
                                                            {type.name}
                                                            {type.default_rate != null &&
                                                                ` (${formatCurrency(type.default_rate)}/${type.default_rate_type})`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )}
                                            {allowancesByCategory.site.length > 0 && (
                                                <SelectGroup>
                                                    <SelectLabel className="text-amber-700 dark:text-amber-400">Site Allowance</SelectLabel>
                                                    {allowancesByCategory.site.map((type) => (
                                                        <SelectItem key={type.id} value={String(type.id)}>
                                                            {type.name}
                                                            {type.default_rate != null &&
                                                                ` (${formatCurrency(type.default_rate)}/${type.default_rate_type})`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )}
                                            {allowancesByCategory.multistorey.length > 0 && (
                                                <SelectGroup>
                                                    <SelectLabel className="text-purple-700 dark:text-purple-400">Multi-storey</SelectLabel>
                                                    {allowancesByCategory.multistorey.map((type) => (
                                                        <SelectItem key={type.id} value={String(type.id)}>
                                                            {type.name}
                                                            {type.default_rate != null &&
                                                                ` (${formatCurrency(type.default_rate)}/${type.default_rate_type})`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )}
                                            {allowancesByCategory.custom.length > 0 && (
                                                <SelectGroup>
                                                    <SelectLabel className="text-slate-700 dark:text-slate-400">Other Allowances</SelectLabel>
                                                    {allowancesByCategory.custom.map((type) => (
                                                        <SelectItem key={type.id} value={String(type.id)}>
                                                            {type.name}
                                                            {type.default_rate != null &&
                                                                ` (${formatCurrency(type.default_rate)}/${type.default_rate_type})`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Select allowances to apply to this template for this job.</p>
                    </div>

                    {/* Configured Allowances - Grouped by Category */}
                    {allowanceConfig.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="mb-3 text-sm font-medium">Configured Allowances</h3>
                            <p className="text-sm text-slate-500">No allowances configured. Add allowances above to customize this template.</p>
                        </div>
                    ) : (
                        <>
                            {/* Fares & Travel */}
                            {configuredByCategory.fares_travel.length > 0 && (
                                <div className={`rounded-lg border p-4 ${CATEGORY_CONFIG.fares_travel.bgColor}`}>
                                    <h3 className={`mb-3 text-sm font-medium ${CATEGORY_CONFIG.fares_travel.color}`}>Fares & Travel</h3>
                                    <div className="space-y-3">{configuredByCategory.fares_travel.map(renderAllowanceItem)}</div>
                                </div>
                            )}

                            {/* Site Allowance */}
                            {configuredByCategory.site.length > 0 && (
                                <div className={`rounded-lg border p-4 ${CATEGORY_CONFIG.site.bgColor}`}>
                                    <h3 className={`mb-3 text-sm font-medium ${CATEGORY_CONFIG.site.color}`}>Site Allowance</h3>
                                    <div className="space-y-3">{configuredByCategory.site.map(renderAllowanceItem)}</div>
                                </div>
                            )}

                            {/* Multi-storey */}
                            {configuredByCategory.multistorey.length > 0 && (
                                <div className={`rounded-lg border p-4 ${CATEGORY_CONFIG.multistorey.bgColor}`}>
                                    <h3 className={`mb-3 text-sm font-medium ${CATEGORY_CONFIG.multistorey.color}`}>Multi-storey</h3>
                                    <div className="space-y-3">{configuredByCategory.multistorey.map(renderAllowanceItem)}</div>
                                </div>
                            )}

                            {/* Other Allowances */}
                            {configuredByCategory.custom.length > 0 && (
                                <div className={`rounded-lg border p-4 ${CATEGORY_CONFIG.custom.bgColor}`}>
                                    <h3 className={`mb-3 text-sm font-medium ${CATEGORY_CONFIG.custom.color}`}>Other Allowances</h3>
                                    <div className="space-y-3">{configuredByCategory.custom.map(renderAllowanceItem)}</div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Total Impact */}
                    {allowanceConfig.length > 0 && (
                        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="font-medium">Total Allowances</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {allowanceConfig.length} allowance{allowanceConfig.length !== 1 ? 's' : ''} configured
                                    </p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                        +
                                        {formatCurrency(
                                            allowanceConfig.reduce((sum, config) => {
                                                if (!config.rate_type) return sum;
                                                return (
                                                    sum + calculateAllowanceWeeklyCost(config.rate, config.rate_type as 'hourly' | 'daily' | 'weekly')
                                                );
                                            }, 0),
                                        )}
                                    </p>
                                    <p className="text-xs text-slate-500">per worker per week</p>
                                    {hasIncompleteAllowances && (
                                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Select rate type for all allowances to save</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || hasIncompleteAllowances}>
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
