import React from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatAmount, formatMonthHeader, getMonthOptions } from '../utils';
import type { GeneralCost, CashInSplit, CashOutSplit, VendorPaymentDelaySplit } from '../types';
import { Trash2 } from 'lucide-react';

// Settings Modal
type SettingsModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    startingBalance: number;
    onStartingBalanceChange: (value: number) => void;
    gstPayMonths: {
        q1: number;
        q2: number;
        q3: number;
        q4: number;
    };
    onGstPayMonthsChange: (months: { q1: number; q2: number; q3: number; q4: number }) => void;
    startingBalanceDate: string | null;
    onSave: () => void;
};

export const SettingsModal = ({
    open,
    onOpenChange,
    startingBalance,
    onStartingBalanceChange,
    gstPayMonths,
    onGstPayMonthsChange,
    onSave,
}: SettingsModalProps) => {
    const monthOptions = getMonthOptions();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cashflow Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Starting Balance</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                $
                            </span>
                            <Input
                                type="number"
                                value={startingBalance}
                                onChange={(e) =>
                                    onStartingBalanceChange(parseFloat(e.target.value) || 0)
                                }
                                className="pl-8"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Opening cash balance for the forecast period
                        </p>
                    </div>
                    <div className="border-t border-border pt-4">
                        <h4 className="text-sm font-semibold mb-3">GST Payable Months</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            {[
                                { key: 'q1', label: 'Q1 (Jan - Mar)' },
                                { key: 'q2', label: 'Q2 (Apr - Jun)' },
                                { key: 'q3', label: 'Q3 (Jul - Sep)' },
                                { key: 'q4', label: 'Q4 (Oct - Dec)' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className="block text-xs font-medium mb-1">{label}</label>
                                    <Select
                                        value={String(gstPayMonths[key as keyof typeof gstPayMonths])}
                                        onValueChange={(value) =>
                                            onGstPayMonthsChange({
                                                ...gstPayMonths,
                                                [key]: parseInt(value, 10),
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Select month" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {monthOptions.map((option) => (
                                                <SelectItem
                                                    key={`gst-${key}-${option.value}`}
                                                    value={String(option.value)}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            These months determine when each quarter's GST is paid.
                        </p>
                    </div>
                </div>
                <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onSave}>Save Settings</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// General Transactions Modal
type GeneralCostsModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    generalCosts: GeneralCost[];
    categories: Record<string, string>;
    frequencies: Record<string, string>;
    newCost: Partial<GeneralCost>;
    onNewCostChange: (cost: Partial<GeneralCost>) => void;
    onAdd: () => void;
    onDelete: (id: number) => void;
};

export const GeneralCostsModal = ({
    open,
    onOpenChange,
    generalCosts,
    categories,
    frequencies,
    newCost,
    onNewCostChange,
    onAdd,
    onDelete,
}: GeneralCostsModalProps) => {
    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this cost?')) {
            onDelete(id);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>General Transactions</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                    {/* Existing Costs */}
                    {generalCosts.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 mb-3">
                                Active Transactions
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {generalCosts.map((cost) => (
                                    <div
                                        key={cost.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-800 flex items-center gap-2">
                                                {cost.name}
                                                <Badge
                                                    variant={
                                                        cost.flow_type === 'cash_in'
                                                            ? 'secondary'
                                                            : 'outline'
                                                    }
                                                    className="text-[10px] uppercase tracking-wide"
                                                >
                                                    {cost.flow_type === 'cash_in' ? 'In' : 'Out'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                ${cost.amount.toLocaleString()}{' '}
                                                {cost.type === 'recurring'
                                                    ? `/ ${frequencies[cost.frequency ?? 'monthly']}`
                                                    : '(one-off)'}
                                                {cost.category && ` • ${categories[cost.category]}`}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(cost.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add New Cost */}
                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">
                            Add New Transaction
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Name *
                                </label>
                                <Input
                                    type="text"
                                    value={newCost.name ?? ''}
                                    onChange={(e) =>
                                        onNewCostChange({ ...newCost, name: e.target.value })
                                    }
                                    placeholder="e.g., Office Rent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Amount *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                                        $
                                    </span>
                                    <Input
                                        type="number"
                                        value={newCost.amount ?? ''}
                                        onChange={(e) =>
                                            onNewCostChange({
                                                ...newCost,
                                                amount: parseFloat(e.target.value) || 0,
                                            })
                                        }
                                        className="pl-8"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Type
                                </label>
                                <Select
                                    value={newCost.type ?? 'recurring'}
                                    onValueChange={(value) =>
                                        onNewCostChange({
                                            ...newCost,
                                            type: value as 'one_off' | 'recurring',
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="recurring">Recurring</SelectItem>
                                        <SelectItem value="one_off">One-off</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Cash Flow
                                </label>
                                <Select
                                    value={newCost.flow_type ?? 'cash_out'}
                                    onValueChange={(value) =>
                                        onNewCostChange({
                                            ...newCost,
                                            flow_type: value as 'cash_in' | 'cash_out',
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Cash flow" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash_out">Cash Out</SelectItem>
                                        <SelectItem value="cash_in">Cash In</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Frequency
                                    </label>
                                    <Select
                                        value={newCost.frequency ?? 'monthly'}
                                        onValueChange={(value) =>
                                            onNewCostChange({ ...newCost, frequency: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select frequency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(frequencies).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Category
                                </label>
                                <Select
                                    value={newCost.category ?? 'none'}
                                    onValueChange={(value) =>
                                        onNewCostChange({
                                            ...newCost,
                                            category: value === 'none' ? '' : value,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Select category</SelectItem>
                                        {Object.entries(categories).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Start Date *
                                </label>
                                <Input
                                    type="date"
                                    value={newCost.start_date ?? ''}
                                    onChange={(e) =>
                                        onNewCostChange({ ...newCost, start_date: e.target.value })
                                    }
                                />
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        End Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={newCost.end_date ?? ''}
                                        onChange={(e) =>
                                            onNewCostChange({ ...newCost, end_date: e.target.value })
                                        }
                                    />
                                </div>
                            )}
                            <div className="col-span-2 flex items-center gap-2">
                                <Checkbox
                                    checked={newCost.includes_gst ?? true}
                                    onCheckedChange={(checked) =>
                                        onNewCostChange({ ...newCost, includes_gst: Boolean(checked) })
                                    }
                                />
                                <span className="text-sm text-muted-foreground">
                                    Amount includes GST
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <Button
                                onClick={onAdd}
                                disabled={!newCost.name || !newCost.amount || !newCost.start_date}
                            >
                                Add Transaction
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Split Adjustment Row Component
type SplitRowProps = {
    index: number;
    monthValue: string;
    amount: number;
    monthOptions: string[];
    onMonthChange: (value: string) => void;
    onAmountChange: (value: number) => void;
    onRemove: () => void;
    monthLabel?: string;
};

const SplitRow = ({
    monthValue,
    amount,
    monthOptions,
    onMonthChange,
    onAmountChange,
    onRemove,
    monthLabel = 'Month',
}: SplitRowProps) => (
    <div className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-slate-100">
        <div className="col-span-5">
            <Select value={monthValue} onValueChange={onMonthChange}>
                <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {monthOptions.map((month) => (
                        <SelectItem key={month} value={month}>
                            {formatMonthHeader(month)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="col-span-5">
            <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    $
                </span>
                <Input
                    type="number"
                    value={amount}
                    onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
                    className="h-9 pl-5 text-sm"
                />
            </div>
        </div>
        <div className="col-span-2 flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
                Remove
            </Button>
        </div>
    </div>
);

// Cash In Adjustment Modal
type CashInAdjustmentModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobNumber: string | null;
    sourceMonth: string | null;
    sourceMonths: string[];
    splits: CashInSplit[];
    sourceAmount: number;
    splitTotal: number;
    isOverBudget: boolean;
    monthOptions: string[];
    onSourceMonthChange: (month: string) => void;
    onSplitChange: (index: number, changes: Partial<CashInSplit>) => void;
    onAddSplit: () => void;
    onRemoveSplit: (index: number) => void;
    onSetSingleSplit: (offsetMonths: number) => void;
    onSave: () => void;
    onReset: () => void;
};

export const CashInAdjustmentModal = ({
    open,
    onOpenChange,
    jobNumber,
    sourceMonth,
    sourceMonths,
    splits,
    sourceAmount,
    splitTotal,
    isOverBudget,
    monthOptions,
    onSourceMonthChange,
    onSplitChange,
    onAddSplit,
    onRemoveSplit,
    onSetSingleSplit,
    onSave,
    onReset,
}: CashInAdjustmentModalProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Adjust Cash In{jobNumber ? ` — ${jobNumber}` : ''}</DialogTitle>
                </DialogHeader>
                {jobNumber && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">
                                    Billing Month
                                </label>
                                <Select value={sourceMonth ?? ''} onValueChange={onSourceMonthChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sourceMonths.map((month) => (
                                            <SelectItem key={month} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">
                                    Billed Amount
                                </label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                <div className="col-span-5">Receipt Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-slate-500">
                                    No adjustments saved. Add a split to move receipts.
                                </div>
                            )}
                            {splits.map((split, index) => (
                                <SplitRow
                                    key={`${split.receipt_month}-${index}`}
                                    index={index}
                                    monthValue={split.receipt_month}
                                    amount={split.amount}
                                    monthOptions={monthOptions}
                                    onMonthChange={(value) =>
                                        onSplitChange(index, { receipt_month: value })
                                    }
                                    onAmountChange={(value) => onSplitChange(index, { amount: value })}
                                    onRemove={() => onRemoveSplit(index)}
                                    monthLabel="Receipt Month"
                                />
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={onAddSplit}>
                                Add Split
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(0)}
                            >
                                Same Month
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(1)}
                            >
                                +1 Month
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(2)}
                            >
                                +2 Months
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(3)}
                            >
                                +3 Months
                            </Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
                            </div>
                            {isOverBudget ? (
                                <span className="text-red-600 font-medium">
                                    Split exceeds billed amount
                                </span>
                            ) : (
                                <span className="text-emerald-600 font-medium">
                                    Remaining: ${formatAmount(sourceAmount - splitTotal)}
                                </span>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onReset}>
                                Reset to Default
                            </Button>
                            <Button type="button" onClick={onSave} disabled={isOverBudget}>
                                Save Adjustments
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Cash Out Adjustment Modal
type CashOutAdjustmentModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobNumber: string | null;
    costItem: string | null;
    vendor: string | null;
    sourceMonth: string | null;
    sourceMonths: string[];
    splits: CashOutSplit[];
    sourceAmount: number;
    splitTotal: number;
    isOverBudget: boolean;
    monthOptions: string[];
    onSourceMonthChange: (month: string) => void;
    onSplitChange: (index: number, changes: Partial<CashOutSplit>) => void;
    onAddSplit: () => void;
    onRemoveSplit: (index: number) => void;
    onSetSingleSplit: (offsetMonths: number) => void;
    onSave: () => void;
    onReset: () => void;
};

export const CashOutAdjustmentModal = ({
    open,
    onOpenChange,
    jobNumber,
    costItem,
    vendor,
    sourceMonth,
    sourceMonths,
    splits,
    sourceAmount,
    splitTotal,
    isOverBudget,
    monthOptions,
    onSourceMonthChange,
    onSplitChange,
    onAddSplit,
    onRemoveSplit,
    onSetSingleSplit,
    onSave,
    onReset,
}: CashOutAdjustmentModalProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Adjust Cash Out{jobNumber ? ` — ${jobNumber}` : ''}
                    </DialogTitle>
                </DialogHeader>
                {jobNumber && costItem && vendor && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Cost Item</label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    {costItem} · {vendor} ·{' '}
                                    {jobNumber === 'ALL' ? 'All Jobs' : jobNumber}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Source Month</label>
                                <Select value={sourceMonth ?? ''} onValueChange={onSourceMonthChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sourceMonths.map((month) => (
                                            <SelectItem key={month} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Source Amount</label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50">
                                <div className="col-span-5">Payment Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-slate-500">
                                    No adjustments saved. Add a split to move payments.
                                </div>
                            )}
                            {splits.map((split, index) => (
                                <SplitRow
                                    key={`${split.payment_month}-${index}`}
                                    index={index}
                                    monthValue={split.payment_month}
                                    amount={split.amount}
                                    monthOptions={monthOptions}
                                    onMonthChange={(value) =>
                                        onSplitChange(index, { payment_month: value })
                                    }
                                    onAmountChange={(value) => onSplitChange(index, { amount: value })}
                                    onRemove={() => onRemoveSplit(index)}
                                    monthLabel="Payment Month"
                                />
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={onAddSplit}>
                                Add Split
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(0)}
                            >
                                Same Month
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(1)}
                            >
                                +1 Month
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(2)}
                            >
                                +2 Months
                            </Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
                            </div>
                            {isOverBudget ? (
                                <span className="text-red-600 font-medium">
                                    Split exceeds source amount
                                </span>
                            ) : (
                                <span className="text-emerald-600 font-medium">
                                    Remaining: ${formatAmount(sourceAmount - splitTotal)}
                                </span>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onReset}>
                                Reset to Default
                            </Button>
                            <Button type="button" onClick={onSave} disabled={isOverBudget}>
                                Save Adjustments
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Vendor Payment Delay Modal
type VendorPaymentDelayModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vendor: string | null;
    sourceMonth: string | null;
    sourceMonths: string[];
    splits: VendorPaymentDelaySplit[];
    sourceAmount: number;
    splitTotal: number;
    isOverBudget: boolean;
    monthOptions: string[];
    onSourceMonthChange: (month: string) => void;
    onSplitChange: (index: number, changes: Partial<VendorPaymentDelaySplit>) => void;
    onAddSplit: () => void;
    onRemoveSplit: (index: number) => void;
    onSetSingleSplit: (offsetMonths: number) => void;
    onSave: () => void;
    onReset: () => void;
};

export const VendorPaymentDelayModal = ({
    open,
    onOpenChange,
    vendor,
    sourceMonth,
    sourceMonths,
    splits,
    sourceAmount,
    splitTotal,
    isOverBudget,
    monthOptions,
    onSourceMonthChange,
    onSplitChange,
    onAddSplit,
    onRemoveSplit,
    onSetSingleSplit,
    onSave,
    onReset,
}: VendorPaymentDelayModalProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Delay Vendor Payments{vendor ? ` — ${vendor}` : ''}
                    </DialogTitle>
                </DialogHeader>
                {vendor && (
                    <div className="space-y-5">
                        <p className="text-sm text-muted-foreground">
                            Delay all payments for this vendor from a source month to different payment months.
                        </p>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Source Month</label>
                                <Select value={sourceMonth ?? ''} onValueChange={onSourceMonthChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sourceMonths.map((month) => (
                                            <SelectItem key={month} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium mb-1">Total Amount</label>
                                <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted text-foreground">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border overflow-hidden">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted">
                                <div className="col-span-5">Payment Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-muted-foreground">
                                    No delays configured. Add a split to delay payments.
                                </div>
                            )}
                            {splits.map((split, index) => (
                                <SplitRow
                                    key={`${split.payment_month}-${index}`}
                                    index={index}
                                    monthValue={split.payment_month}
                                    amount={split.amount}
                                    monthOptions={monthOptions}
                                    onMonthChange={(value) =>
                                        onSplitChange(index, { payment_month: value })
                                    }
                                    onAmountChange={(value) => onSplitChange(index, { amount: value })}
                                    onRemove={() => onRemoveSplit(index)}
                                    monthLabel="Payment Month"
                                />
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={onAddSplit}>
                                Add Split
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(0)}
                            >
                                Same Month
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(1)}
                            >
                                +1 Month
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(2)}
                            >
                                +2 Months
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSetSingleSplit(3)}
                            >
                                +3 Months
                            </Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div>
                                Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
                            </div>
                            {isOverBudget ? (
                                <span className="text-destructive font-medium">
                                    Split exceeds source amount
                                </span>
                            ) : (
                                <span className="text-emerald-600 font-medium">
                                    Remaining: ${formatAmount(sourceAmount - splitTotal)}
                                </span>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onReset}>
                                Reset to Default
                            </Button>
                            <Button type="button" onClick={onSave} disabled={isOverBudget}>
                                Save Delays
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Fullscreen Chart Modal
type FullscreenChartModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: React.ReactNode;
};

export const FullscreenChartModal = ({
    open,
    onOpenChange,
    title,
    children,
}: FullscreenChartModalProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh]">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="h-[70vh] w-full">{children}</div>
        </DialogContent>
    </Dialog>
);
