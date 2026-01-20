import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import React from 'react';
import type { CashInSplit, CashOutSplit, GeneralCost, VendorPaymentDelaySplit } from '../types';
import { formatAmount, formatMonthHeader, getMonthOptions } from '../utils';

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
                        <label className="mb-1 block text-sm font-medium">Starting Balance</label>
                        <div className="relative">
                            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">$</span>
                            <Input
                                type="number"
                                value={startingBalance}
                                onChange={(e) => onStartingBalanceChange(parseFloat(e.target.value) || 0)}
                                className="pl-8"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">Opening cash balance for the forecast period</p>
                    </div>
                    <div className="border-border border-t pt-4">
                        <h4 className="mb-3 text-sm font-semibold">GST Payable Months</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            {[
                                { key: 'q1', label: 'Q1 (Jan - Mar)' },
                                { key: 'q2', label: 'Q2 (Apr - Jun)' },
                                { key: 'q3', label: 'Q3 (Jul - Sep)' },
                                { key: 'q4', label: 'Q4 (Oct - Dec)' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className="mb-1 block text-xs font-medium">{label}</label>
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
                                                <SelectItem key={`gst-${key}-${option.value}`} value={String(option.value)}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs">These months determine when each quarter's GST is paid.</p>
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
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>General Transactions</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                    {/* Existing Costs */}
                    {generalCosts.length > 0 && (
                        <div>
                            <h4 className="mb-3 text-sm font-medium text-slate-700">Active Transactions</h4>
                            <div className="max-h-48 space-y-2 overflow-y-auto">
                                {generalCosts.map((cost) => (
                                    <div key={cost.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                                        <div>
                                            <div className="flex items-center gap-2 font-medium text-slate-800">
                                                {cost.name}
                                                <Badge
                                                    variant={cost.flow_type === 'cash_in' ? 'secondary' : 'outline'}
                                                    className="text-[10px] tracking-wide uppercase"
                                                >
                                                    {cost.flow_type === 'cash_in' ? 'In' : 'Out'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                ${cost.amount.toLocaleString()}{' '}
                                                {cost.type === 'recurring' ? `/ ${frequencies[cost.frequency ?? 'monthly']}` : '(one-off)'}
                                                {cost.category && ` • ${categories[cost.category]}`}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(cost.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add New Cost */}
                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="mb-3 text-sm font-medium text-slate-700">Add New Transaction</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">Name *</label>
                                <Input
                                    type="text"
                                    value={newCost.name ?? ''}
                                    onChange={(e) => onNewCostChange({ ...newCost, name: e.target.value })}
                                    placeholder="e.g., Office Rent"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">Amount *</label>
                                <div className="relative">
                                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">$</span>
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
                                <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
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
                                <label className="mb-1 block text-xs font-medium text-slate-600">Cash Flow</label>
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
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Frequency</label>
                                    <Select
                                        value={newCost.frequency ?? 'monthly'}
                                        onValueChange={(value) => onNewCostChange({ ...newCost, frequency: value })}
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
                                <label className="mb-1 block text-xs font-medium text-slate-600">Category</label>
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
                                <label className="mb-1 block text-xs font-medium text-slate-600">Start Date *</label>
                                <Input
                                    type="date"
                                    value={newCost.start_date ?? ''}
                                    onChange={(e) => onNewCostChange({ ...newCost, start_date: e.target.value })}
                                />
                            </div>
                            {newCost.type === 'recurring' && (
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">End Date</label>
                                    <Input
                                        type="date"
                                        value={newCost.end_date ?? ''}
                                        onChange={(e) => onNewCostChange({ ...newCost, end_date: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="col-span-2 flex items-center gap-2">
                                <Checkbox
                                    checked={newCost.includes_gst ?? true}
                                    onCheckedChange={(checked) => onNewCostChange({ ...newCost, includes_gst: Boolean(checked) })}
                                />
                                <span className="text-muted-foreground text-sm">Amount includes GST</span>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={onAdd} disabled={!newCost.name || !newCost.amount || !newCost.start_date}>
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

const SplitRow = ({ monthValue, amount, monthOptions, onMonthChange, onAmountChange, onRemove, monthLabel = 'Month' }: SplitRowProps) => (
    <div className="grid grid-cols-12 gap-2 border-t border-slate-100 px-3 py-2">
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
                <span className="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <Input type="number" value={amount} onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)} className="h-9 pl-5 text-sm" />
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
                                <label className="mb-1 block text-xs font-medium">Billing Month</label>
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
                                <label className="mb-1 block text-xs font-medium">Billed Amount</label>
                                <div className="border-border bg-muted text-foreground rounded-lg border px-3 py-2 text-sm">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                <div className="col-span-5">Receipt Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-slate-500">No adjustments saved. Add a split to move receipts.</div>
                            )}
                            {splits.map((split, index) => (
                                <SplitRow
                                    key={`${split.receipt_month}-${index}`}
                                    index={index}
                                    monthValue={split.receipt_month}
                                    amount={split.amount}
                                    monthOptions={monthOptions}
                                    onMonthChange={(value) => onSplitChange(index, { receipt_month: value })}
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
                            <div className="bg-border h-4 w-px" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(0)}>
                                Same Month
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(1)}>
                                +1 Month
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(2)}>
                                +2 Months
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(3)}>
                                +3 Months
                            </Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
                            </div>
                            {isOverBudget ? (
                                <span className="font-medium text-red-600">Split exceeds billed amount</span>
                            ) : (
                                <span className="font-medium text-emerald-600">Remaining: ${formatAmount(sourceAmount - splitTotal)}</span>
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
                    <DialogTitle>Adjust Cash Out{jobNumber ? ` — ${jobNumber}` : ''}</DialogTitle>
                </DialogHeader>
                {jobNumber && costItem && vendor && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-medium">Cost Item</label>
                                <div className="border-border bg-muted text-foreground rounded-lg border px-3 py-2 text-sm">
                                    {costItem} · {vendor} · {jobNumber === 'ALL' ? 'All Jobs' : jobNumber}
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-medium">Source Month</label>
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
                                <label className="mb-1 block text-xs font-medium">Source Amount</label>
                                <div className="border-border bg-muted text-foreground rounded-lg border px-3 py-2 text-sm">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-200">
                            <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                <div className="col-span-5">Payment Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {splits.length === 0 && (
                                <div className="px-3 py-3 text-sm text-slate-500">No adjustments saved. Add a split to move payments.</div>
                            )}
                            {splits.map((split, index) => (
                                <SplitRow
                                    key={`${split.payment_month}-${index}`}
                                    index={index}
                                    monthValue={split.payment_month}
                                    amount={split.amount}
                                    monthOptions={monthOptions}
                                    onMonthChange={(value) => onSplitChange(index, { payment_month: value })}
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
                            <div className="bg-border h-4 w-px" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(0)}>
                                Same Month
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(1)}>
                                +1 Month
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(2)}>
                                +2 Months
                            </Button>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
                            </div>
                            {isOverBudget ? (
                                <span className="font-medium text-red-600">Split exceeds source amount</span>
                            ) : (
                                <span className="font-medium text-emerald-600">Remaining: ${formatAmount(sourceAmount - splitTotal)}</span>
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
                    <DialogTitle>Delay Vendor Payments{vendor ? ` — ${vendor}` : ''}</DialogTitle>
                </DialogHeader>
                {vendor && (
                    <div className="space-y-5">
                        <p className="text-muted-foreground text-sm">
                            Delay all payments for this vendor from a source month to different payment months.
                        </p>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs font-medium">Source Month</label>
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
                                <label className="mb-1 block text-xs font-medium">Total Amount</label>
                                <div className="border-border bg-muted text-foreground rounded-lg border px-3 py-2 text-sm">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <div className="border-border overflow-hidden rounded-xl border">
                            <div className="text-muted-foreground bg-muted grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold">
                                <div className="col-span-5">Payment Month</div>
                                <div className="col-span-5">Amount</div>
                                <div className="col-span-2 text-right">Action</div>
                            </div>
                            {splits.length === 0 && (
                                <div className="text-muted-foreground px-3 py-3 text-sm">No delays configured. Add a split to delay payments.</div>
                            )}
                            {splits.map((split, index) => (
                                <SplitRow
                                    key={`${split.payment_month}-${index}`}
                                    index={index}
                                    monthValue={split.payment_month}
                                    amount={split.amount}
                                    monthOptions={monthOptions}
                                    onMonthChange={(value) => onSplitChange(index, { payment_month: value })}
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
                            <div className="bg-border h-4 w-px" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(0)}>
                                Same Month
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(1)}>
                                +1 Month
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(2)}>
                                +2 Months
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(3)}>
                                +3 Months
                            </Button>
                        </div>

                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <div>
                                Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
                            </div>
                            {isOverBudget ? (
                                <span className="text-destructive font-medium">Split exceeds source amount</span>
                            ) : (
                                <span className="font-medium text-emerald-600">Remaining: ${formatAmount(sourceAmount - splitTotal)}</span>
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

export const FullscreenChartModal = ({ open, onOpenChange, title, children }: FullscreenChartModalProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[95vh] max-w-[95vw]">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="h-[70vh] w-full">{children}</div>
        </DialogContent>
    </Dialog>
);

// GST Breakdown Modal
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import type { GstQuarterBreakdown, GstTransaction } from '../types';

type GstBreakdownModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    gstBreakdown: GstQuarterBreakdown[];
};

const GstTransactionTable = ({ transactions, type }: { transactions: GstTransaction[]; type: 'collected' | 'paid' }) => {
    if (transactions.length === 0) {
        return <div className="text-muted-foreground py-4 text-center text-sm">No GST {type} transactions in this quarter</div>;
    }

    // Group transactions by month for better readability
    const groupedByMonth = transactions.reduce(
        (acc, t) => {
            if (!acc[t.month]) {
                acc[t.month] = [];
            }
            acc[t.month].push(t);
            return acc;
        },
        {} as Record<string, GstTransaction[]>,
    );

    return (
        <div className="space-y-4">
            {Object.entries(groupedByMonth).map(([month, monthTransactions]) => (
                <div key={month}>
                    <div className="text-muted-foreground bg-background sticky top-0 mb-2 py-1 text-xs font-medium">{formatMonthHeader(month)}</div>
                    <table className="w-full table-fixed text-xs">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left">
                                {type === 'collected' ? (
                                    <th className="w-[40%] pb-2 font-medium">Job</th>
                                ) : (
                                    <>
                                        <th className="w-[30%] pb-2 font-medium">Vendor</th>
                                        <th className="w-[25%] pb-2 font-medium">Cost Item</th>
                                    </>
                                )}
                                <th className="w-[18%] pb-2 text-right font-medium">Gross</th>
                                <th className="w-[15%] pb-2 text-right font-medium">GST</th>
                                <th className="w-[12%] pb-2 text-center font-medium">Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthTransactions.map((t, idx) => (
                                <tr key={idx} className="border-border/50 hover:bg-muted/50 border-b">
                                    {type === 'collected' ? (
                                        <td className="truncate py-1.5">{t.job_number || '-'}</td>
                                    ) : (
                                        <>
                                            <td className="truncate py-1.5" title={t.vendor || 'N/A'}>
                                                {t.vendor || 'N/A'}
                                            </td>
                                            <td className="truncate py-1.5" title={t.cost_item_description || t.cost_item || ''}>
                                                <span className="font-mono">{t.cost_item}</span>
                                            </td>
                                        </>
                                    )}
                                    <td className="py-1.5 text-right tabular-nums">${formatAmount(t.gross_amount)}</td>
                                    <td className="py-1.5 text-right font-medium tabular-nums">${formatAmount(t.gst_amount)}</td>
                                    <td className="py-1.5 text-center">
                                        <Badge variant={t.source === 'actual' ? 'default' : 'secondary'} className="text-[10px]">
                                            {t.source}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
};

export const GstBreakdownModal = ({ open, onOpenChange, gstBreakdown }: GstBreakdownModalProps) => {
    const [selectedQuarter, setSelectedQuarter] = useState(gstBreakdown[0]?.quarter || '');

    const exportToExcel = (quarter: GstQuarterBreakdown) => {
        const wb = XLSX.utils.book_new();

        // GST Collected Sheet
        const collectedData = [
            ['GST COLLECTED (Revenue)'],
            ['Quarter:', quarter.quarter_label],
            [''],
            ['Month', 'Job Number', 'Gross Amount', 'GST Amount', 'Source'],
            ...quarter.collected.transactions.map((t) => [
                formatMonthHeader(t.month),
                t.job_number || '-',
                t.gross_amount,
                t.gst_amount,
                t.source,
            ]),
            [''],
            ['', 'SUBTOTAL', quarter.collected.transactions.reduce((sum, t) => sum + t.gross_amount, 0), quarter.collected.total, ''],
        ];
        const wsCollected = XLSX.utils.aoa_to_sheet(collectedData);
        // Set column widths
        wsCollected['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsCollected, 'GST Collected');

        // GST Paid Sheet
        const paidData = [
            ['GST PAID (Costs)'],
            ['Quarter:', quarter.quarter_label],
            [''],
            ['Month', 'Vendor', 'Cost Item', 'Description', 'Gross Amount', 'GST Amount', 'Source'],
            ...quarter.paid.transactions.map((t) => [
                formatMonthHeader(t.month),
                t.vendor || 'N/A',
                t.cost_item || '-',
                t.cost_item_description || '',
                t.gross_amount,
                t.gst_amount,
                t.source,
            ]),
            [''],
            ['', '', '', 'SUBTOTAL', quarter.paid.transactions.reduce((sum, t) => sum + t.gross_amount, 0), quarter.paid.total, ''],
        ];
        const wsPaid = XLSX.utils.aoa_to_sheet(paidData);
        wsPaid['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsPaid, 'GST Paid');

        // Summary Sheet
        const summaryData = [
            ['GST SUMMARY'],
            ['Quarter:', quarter.quarter_label],
            ['Due Date:', formatMonthHeader(quarter.pay_month)],
            [''],
            ['Description', 'Amount'],
            ['GST Collected (Revenue)', quarter.collected.total],
            ['GST Paid (Costs)', quarter.paid.total],
            [''],
            [quarter.net >= 0 ? 'Net GST Payable' : 'Net GST Refund', Math.abs(quarter.net)],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary['!cols'] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // Download
        XLSX.writeFile(wb, `GST_Breakdown_${quarter.quarter_label.replace(' ', '_')}.xlsx`);
    };

    if (gstBreakdown.length === 0) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>GST Breakdown</DialogTitle>
                    </DialogHeader>
                    <div className="text-muted-foreground py-8 text-center">No GST data available for the forecast period</div>
                </DialogContent>
            </Dialog>
        );
    }

    const currentQuarter = gstBreakdown.find((q) => q.quarter === selectedQuarter) || gstBreakdown[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>GST Breakdown by Quarter</DialogTitle>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToExcel(currentQuarter)}>
                        <Download className="h-4 w-4" />
                        Export to Excel
                    </Button>
                </DialogHeader>
                <Tabs value={selectedQuarter} onValueChange={setSelectedQuarter} className="w-full">
                    <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                        {gstBreakdown.map((q) => (
                            <TabsTrigger key={q.quarter} value={q.quarter} className="text-xs whitespace-nowrap">
                                {q.quarter_label}
                                <span className={`ml-2 text-[10px] ${q.net >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {q.net >= 0 ? 'Payable' : 'Refund'}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {gstBreakdown.map((q) => (
                        <TabsContent key={q.quarter} value={q.quarter} className="mt-4">
                            {/* Summary */}
                            <div className="mb-6 grid grid-cols-3 gap-4">
                                <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                                    <div className="text-xs font-medium text-green-600 dark:text-green-400">GST Collected (Revenue)</div>
                                    <div className="text-lg font-bold text-green-700 tabular-nums dark:text-green-300">
                                        ${formatAmount(q.collected.total)}
                                    </div>
                                    <div className="text-muted-foreground text-[10px]">{q.collected.transactions.length} transactions</div>
                                </div>
                                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400">GST Paid (Costs)</div>
                                    <div className="text-lg font-bold text-blue-700 tabular-nums dark:text-blue-300">
                                        ${formatAmount(q.paid.total)}
                                    </div>
                                    <div className="text-muted-foreground text-[10px]">{q.paid.transactions.length} transactions</div>
                                </div>
                                <div
                                    className={`rounded-lg p-3 ${
                                        q.net >= 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'
                                    }`}
                                >
                                    <div
                                        className={`text-xs font-medium ${
                                            q.net >= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                    >
                                        Net GST {q.net >= 0 ? 'Payable' : 'Refund'}
                                    </div>
                                    <div
                                        className={`text-lg font-bold tabular-nums ${
                                            q.net >= 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                                        }`}
                                    >
                                        ${formatAmount(Math.abs(q.net))}
                                    </div>
                                    <div className="text-muted-foreground text-[10px]">Due: {formatMonthHeader(q.pay_month)}</div>
                                </div>
                            </div>

                            {/* Transaction Details */}
                            <div className="grid grid-cols-2 gap-8">
                                <div className="min-w-0">
                                    <h4 className="mb-3 text-sm font-semibold text-green-700 dark:text-green-400">GST Collected (from Revenue)</h4>
                                    <ScrollArea className="h-[350px] rounded-lg border p-3">
                                        <div className="min-w-full">
                                            <GstTransactionTable transactions={q.collected.transactions} type="collected" />
                                        </div>
                                    </ScrollArea>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="mb-3 text-sm font-semibold text-blue-700 dark:text-blue-400">GST Paid (on Costs)</h4>
                                    <ScrollArea className="h-[350px] rounded-lg border p-3">
                                        <div className="min-w-full">
                                            <GstTransactionTable transactions={q.paid.transactions} type="paid" />
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
