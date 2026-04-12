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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { router } from '@inertiajs/react';
import { Check, Info, Loader2, Plus, X } from 'lucide-react';
import * as React from 'react';
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

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
    fares_travel: 'Fares & Travel',
    site: 'Site Allowance',
    multistorey: 'Multi-storey',
    custom: 'Other Allowances',
};

// Searchable combobox for picking an allowance to add
type AllowanceOptionItem = AllowanceType & { label: string };

const AllowanceCombobox = ({ items, onSelect }: { items: AllowanceOptionItem[]; onSelect: (item: AllowanceOptionItem) => void }) => {
    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState('');

    return (
        <Combobox<AllowanceOptionItem>
            items={items}
            open={open}
            value={null}
            inputValue={inputValue}
            itemToStringLabel={(item) => item.name}
            itemToStringValue={(item) => String(item.id)}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) setInputValue('');
            }}
            onInputValueChange={setInputValue}
            onValueChange={(value) => {
                if (value) {
                    onSelect(value);
                    setOpen(false);
                    setInputValue('');
                }
            }}
        >
            <ComboboxTrigger
                render={<Button variant="outline" className="w-full justify-between overflow-hidden" />}
                aria-label="Select allowance"
            >
                <span className="truncate text-muted-foreground">Search allowances...</span>
            </ComboboxTrigger>

            <ComboboxContent className="w-(--anchor-width) p-0">
                <ComboboxInput placeholder="Search allowances..." className="h-9" showTrigger={false} />
                <ComboboxEmpty>No allowances found.</ComboboxEmpty>
                <ComboboxList>
                    {(option: AllowanceOptionItem) => (
                        <ComboboxItem key={option.id} value={option}>
                            <span className="truncate">{option.name}</span>
                            {option.default_rate != null && (
                                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                    {formatCurrency(option.default_rate)}/{option.default_rate_type}
                                </span>
                            )}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
};

export const AllowanceConfigDialog = ({ open, onOpenChange, template, allowanceTypes, locationId }: AllowanceConfigDialogProps) => {
    const [allowanceConfig, setAllowanceConfig] = useState<LocalAllowanceConfigItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);

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

    // Flat list of available allowances for the combobox
    const availableAllowancesList = useMemo(() => {
        const configuredIds = allowanceConfig.map((a) => a.allowance_type_id);
        return allowanceTypes
            .filter((t) => !configuredIds.includes(t.id))
            .map((t) => ({
                ...t,
                label: t.name + (t.default_rate != null ? ` (${formatCurrency(t.default_rate)}/${t.default_rate_type})` : ''),
            }));
    }, [allowanceTypes, allowanceConfig]);

    const hasIncompleteAllowances = useMemo(() => {
        return allowanceConfig.some((a) => !a.rate_type);
    }, [allowanceConfig]);

    // Handlers
    const handleAddAllowance = (allowanceTypeId: number) => {
        const allowanceType = allowanceTypes.find((t) => t.id === allowanceTypeId);
        if (!allowanceType) return;

        const defaultPaidToRdo = allowanceType.category === 'fares_travel';

        setAllowanceConfig((prev) => [
            ...prev,
            {
                allowance_type_id: allowanceTypeId,
                rate: allowanceType.default_rate || 0,
                rate_type: '',
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
            <div key={config.allowance_type_id} className="rounded-lg border bg-card p-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{config.allowanceType.name}</div>
                        {config.allowanceType.description && (
                            <div className="text-xs text-muted-foreground">{config.allowanceType.description}</div>
                        )}
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 p-0"
                        onClick={() => handleRemoveAllowance(config.allowance_type_id)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Rate controls */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">$</span>
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
                        <SelectTrigger className={`h-8 w-28 ${!config.rate_type ? 'border-destructive' : ''}`}>
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
                                <span>
                                    <Badge variant="secondary" className="cursor-help">
                                        {formatCurrency(weeklyCost)}/wk
                                    </Badge>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                Weekly cost: {formatCurrency(config.rate)} x{' '}
                                {config.rate_type === 'hourly' ? '40 hrs' : config.rate_type === 'daily' ? '5 days' : '1'}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                            Select rate type
                        </Badge>
                    )}
                </div>

                {/* RDO Option */}
                <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <Checkbox
                        id={`rdo-${config.allowance_type_id}`}
                        checked={config.paid_to_rdo}
                        onCheckedChange={(checked) => handleUpdateAllowancePaidToRdo(config.allowance_type_id, checked as boolean)}
                    />
                    <label htmlFor={`rdo-${config.allowance_type_id}`} className="cursor-pointer text-sm">
                        Pay during RDO hours
                    </label>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground" />
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 shrink-0" />
                        Configure Allowances
                    </DialogTitle>
                    <DialogDescription>
                        Add and configure allowances for <span className="font-medium">{template.label}</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Base template info */}
                    <Card size="sm">
                        <CardContent>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <h3 className="truncate text-sm font-medium">{template.name}</h3>
                                    <p className="text-sm text-muted-foreground">Base Rate: {formatCurrency(template.hourly_rate)}/hr</p>
                                </div>
                                <div className="sm:text-right">
                                    <p className="text-xs text-muted-foreground">Base Weekly Cost</p>
                                    <p className="text-lg font-semibold">{formatCurrency(template.cost_breakdown.base_weekly_wages)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Add Allowance */}
                    <Card size="sm">
                        <CardHeader>
                            <CardTitle>Add Allowance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AllowanceCombobox
                                items={availableAllowancesList}
                                onSelect={(item) => handleAddAllowance(item.id)}
                            />
                            <p className="mt-2 text-xs text-muted-foreground">Search and select allowances to apply to this template.</p>
                        </CardContent>
                    </Card>

                    {/* Configured Allowances - Grouped by Category */}
                    {allowanceConfig.length === 0 ? (
                        <Card size="sm">
                            <CardHeader>
                                <CardTitle>Configured Allowances</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">No allowances configured. Add allowances above to customize this template.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {Object.entries(configuredByCategory).map(([category, items]) => {
                                if (items.length === 0) return null;
                                return (
                                    <Card key={category} size="sm">
                                        <CardHeader>
                                            <CardTitle>{CATEGORY_LABELS[category] || category}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {items.map(renderAllowanceItem)}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </>
                    )}

                    {/* Total Impact */}
                    {allowanceConfig.length > 0 && (
                        <Card size="sm">
                            <CardContent>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium">Total Allowances</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {allowanceConfig.length} allowance{allowanceConfig.length !== 1 ? 's' : ''} configured
                                        </p>
                                    </div>
                                    <div className="sm:text-right">
                                        <p className="text-2xl font-bold">
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
                                        <p className="text-xs text-muted-foreground">per worker per week</p>
                                        {hasIncompleteAllowances && (
                                            <p className="mt-1 text-xs text-destructive">Select rate type for all allowances to save</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
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
