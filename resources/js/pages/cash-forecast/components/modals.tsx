import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { router } from '@inertiajs/react';
import { Download, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type {
    BreakdownFilter,
    BreakdownRow,
    CashInSplit,
    CashOutSplit,
    GeneralCost,
    GstQuarterBreakdown,
    GstTransaction,
    RetentionSetting,
    VendorPaymentDelaySplit,
} from '../types';
import { formatAmount, formatMonthHeader, getCostItemLabel, getMonthOptions } from '../utils';

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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Cashflow Settings</DialogTitle>
                    <DialogDescription>Configure starting balance and GST payment schedule.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="starting-balance">Starting Balance</Label>
                        <div className="relative">
                            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">$</span>
                            <Input
                                id="starting-balance"
                                type="number"
                                value={startingBalance}
                                onChange={(e) => onStartingBalanceChange(parseFloat(e.target.value) || 0)}
                                className="pl-8"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-muted-foreground text-xs">Opening cash balance for the forecast period</p>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                        <Label>GST Payable Months</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'q1', label: 'Q1 (Jan - Mar)' },
                                { key: 'q2', label: 'Q2 (Apr - Jun)' },
                                { key: 'q3', label: 'Q3 (Jul - Sep)' },
                                { key: 'q4', label: 'Q4 (Oct - Dec)' },
                            ].map(({ key, label }) => (
                                <div key={key} className="space-y-1.5">
                                    <Label className="text-xs">{label}</Label>
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
                        <p className="text-muted-foreground text-xs">These months determine when each quarter's GST is paid.</p>
                    </div>
                </div>
                <DialogFooter>
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
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const handleConfirmDelete = () => {
        if (deleteId !== null) {
            onDelete(deleteId);
            setDeleteId(null);
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>General Transactions</DialogTitle>
                    <DialogDescription>Manage recurring and one-off cash flow transactions.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                    {generalCosts.length > 0 && (
                        <div className="space-y-3">
                            <Label>Active Transactions</Label>
                            <div className="max-h-48 space-y-2 overflow-y-auto">
                                {generalCosts.map((cost) => (
                                    <div key={cost.id} className="bg-muted flex items-center justify-between rounded-lg p-3">
                                        <div className="space-y-1">
                                            <div className="text-foreground flex items-center gap-2 text-sm font-medium">
                                                {cost.name}
                                                <Badge
                                                    variant={cost.flow_type === 'cash_in' ? 'secondary' : 'outline'}
                                                    className="text-[10px] tracking-wide uppercase"
                                                >
                                                    {cost.flow_type === 'cash_in' ? 'In' : 'Out'}
                                                </Badge>
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                ${cost.amount.toLocaleString()}{' '}
                                                {cost.type === 'recurring' ? `/ ${frequencies[cost.frequency ?? 'monthly']}` : '(one-off)'}
                                                {cost.category && ` · ${categories[cost.category]}`}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteId(cost.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Separator />

                    <div className="space-y-4">
                        <Label>Add New Transaction</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs" htmlFor="cost-name">Name *</Label>
                                <Input
                                    id="cost-name"
                                    type="text"
                                    value={newCost.name ?? ''}
                                    onChange={(e) => onNewCostChange({ ...newCost, name: e.target.value })}
                                    placeholder="e.g., Office Rent"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs" htmlFor="cost-amount">Amount *</Label>
                                <div className="relative">
                                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">$</span>
                                    <Input
                                        id="cost-amount"
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
                            <div className="space-y-1.5">
                                <Label className="text-xs">Type</Label>
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
                            <div className="space-y-1.5">
                                <Label className="text-xs">Cash Flow</Label>
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
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Frequency</Label>
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
                            <div className="space-y-1.5">
                                <Label className="text-xs">Category</Label>
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
                            <div className="space-y-1.5">
                                <Label className="text-xs" htmlFor="cost-start-date">Start Date *</Label>
                                <Input
                                    id="cost-start-date"
                                    type="date"
                                    value={newCost.start_date ?? ''}
                                    onChange={(e) => onNewCostChange({ ...newCost, start_date: e.target.value })}
                                />
                            </div>
                            {newCost.type === 'recurring' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs" htmlFor="cost-end-date">End Date</Label>
                                    <Input
                                        id="cost-end-date"
                                        type="date"
                                        value={newCost.end_date ?? ''}
                                        onChange={(e) => onNewCostChange({ ...newCost, end_date: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                                <Checkbox
                                    id="includes-gst"
                                    checked={newCost.includes_gst ?? true}
                                    onCheckedChange={(checked) => onNewCostChange({ ...newCost, includes_gst: Boolean(checked) })}
                                />
                                <Label htmlFor="includes-gst" className="text-sm font-normal">Amount includes GST</Label>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={onAdd} disabled={!newCost.name || !newCost.amount || !newCost.start_date}>
                                <Plus className="mr-1 h-4 w-4" />
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

        <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this transaction? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SplitRow = ({ monthValue, amount, monthOptions, onMonthChange, onAmountChange, onRemove, monthLabel = 'Month' }: SplitRowProps) => (
    <div className="border-border grid grid-cols-12 items-center gap-1.5 sm:gap-2 border-t px-2 sm:px-3 py-1.5 sm:py-2">
        <div className="col-span-5">
            <Select value={monthValue} onValueChange={onMonthChange}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
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
        <div className="col-span-4 sm:col-span-5">
            <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-2 -translate-y-1/2 text-xs">$</span>
                <Input type="number" value={amount} onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)} className="h-8 sm:h-9 pl-5 text-xs sm:text-sm" />
            </div>
        </div>
        <div className="col-span-3 sm:col-span-2 flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive h-7 px-1.5 sm:px-3 text-[10px] sm:text-sm">
                <Trash2 className="h-3.5 w-3.5 sm:hidden" />
                <span className="hidden sm:inline">Remove</span>
            </Button>
        </div>
    </div>
);

// Shared Split Table component
const SplitTable = ({
    splits,
    monthOptions,
    monthColumnLabel,
    emptyMessage,
    monthKey,
    onSplitChange,
    onRemoveSplit,
}: {
    splits: Array<{ amount: number; [key: string]: unknown }>;
    monthOptions: string[];
    monthColumnLabel: string;
    emptyMessage: string;
    monthKey: string;
    onSplitChange: (index: number, changes: Record<string, unknown>) => void;
    onRemoveSplit: (index: number) => void;
}) => (
    <div className="border-border overflow-hidden rounded-lg border">
        <div className="bg-muted text-muted-foreground grid grid-cols-12 gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium">
            <div className="col-span-5">{monthColumnLabel}</div>
            <div className="col-span-4 sm:col-span-5">Amount</div>
            <div className="col-span-3 sm:col-span-2 text-right">Action</div>
        </div>
        {splits.length === 0 && (
            <div className="text-muted-foreground px-3 py-3 text-sm">{emptyMessage}</div>
        )}
        {splits.map((split, index) => (
            <SplitRow
                key={`${String(split[monthKey])}-${index}`}
                index={index}
                monthValue={String(split[monthKey])}
                amount={split.amount}
                monthOptions={monthOptions}
                onMonthChange={(value) => onSplitChange(index, { [monthKey]: value })}
                onAmountChange={(value) => onSplitChange(index, { amount: value })}
                onRemove={() => onRemoveSplit(index)}
                monthLabel={monthColumnLabel}
            />
        ))}
    </div>
);

// Shared Split Actions
const SplitActions = ({
    onAddSplit,
    onSetSingleSplit,
    maxOffset = 3,
}: {
    onAddSplit: () => void;
    onSetSingleSplit: (offset: number) => void;
    maxOffset?: number;
}) => (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onAddSplit} className="h-7 sm:h-8 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            Add Split
        </Button>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <Button type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(0)} className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3">
            Same Month
        </Button>
        {Array.from({ length: maxOffset }, (_, i) => i + 1).map((offset) => (
            <Button key={offset} type="button" variant="secondary" size="sm" onClick={() => onSetSingleSplit(offset)} className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3">
                +{offset}m
            </Button>
        ))}
    </div>
);

// Shared Split Summary
const SplitSummary = ({
    splitTotal,
    sourceAmount,
    isOverBudget,
    overLabel = 'Split exceeds source amount',
}: {
    splitTotal: number;
    sourceAmount: number;
    isOverBudget: boolean;
    overLabel?: string;
}) => (
    <div className="text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px] sm:text-xs">
        <div className="tabular-nums">
            Total split: ${formatAmount(splitTotal)} / ${formatAmount(sourceAmount)}
        </div>
        {isOverBudget ? (
            <span className="text-destructive font-medium">{overLabel}</span>
        ) : (
            <span className="text-muted-foreground font-medium">Remaining: ${formatAmount(sourceAmount - splitTotal)}</span>
        )}
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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Adjust Cash In{jobNumber ? ` — ${jobNumber}` : ''}</DialogTitle>
                    <DialogDescription>Split or delay receipt of billed amounts across months.</DialogDescription>
                </DialogHeader>
                {jobNumber && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1 space-y-1.5">
                                <Label>Billing Month</Label>
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
                            <div className="flex-1 space-y-1.5">
                                <Label>Billed Amount</Label>
                                <div className="bg-muted text-foreground rounded-md border px-3 py-2 text-sm tabular-nums">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <SplitTable
                            splits={splits}
                            monthOptions={monthOptions}
                            monthColumnLabel="Receipt Month"
                            emptyMessage="No adjustments saved. Add a split to move receipts."
                            monthKey="receipt_month"
                            onSplitChange={(index, changes) => onSplitChange(index, changes as Partial<CashInSplit>)}
                            onRemoveSplit={onRemoveSplit}
                        />

                        <SplitActions onAddSplit={onAddSplit} onSetSingleSplit={onSetSingleSplit} />
                        <SplitSummary splitTotal={splitTotal} sourceAmount={sourceAmount} isOverBudget={isOverBudget} overLabel="Split exceeds billed amount" />

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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Adjust Cash Out{jobNumber ? ` — ${jobNumber}` : ''}</DialogTitle>
                    <DialogDescription>Split or delay payment amounts across months.</DialogDescription>
                </DialogHeader>
                {jobNumber && costItem && vendor && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1 space-y-1.5">
                                <Label>Cost Item</Label>
                                <div className="bg-muted text-foreground rounded-md border px-3 py-2 text-sm">
                                    {costItem} · {vendor} · {jobNumber === 'ALL' ? 'All Jobs' : jobNumber}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <Label>Source Month</Label>
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
                            <div className="flex-1 space-y-1.5">
                                <Label>Source Amount</Label>
                                <div className="bg-muted text-foreground rounded-md border px-3 py-2 text-sm tabular-nums">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <SplitTable
                            splits={splits}
                            monthOptions={monthOptions}
                            monthColumnLabel="Payment Month"
                            emptyMessage="No adjustments saved. Add a split to move payments."
                            monthKey="payment_month"
                            onSplitChange={(index, changes) => onSplitChange(index, changes as Partial<CashOutSplit>)}
                            onRemoveSplit={onRemoveSplit}
                        />

                        <SplitActions onAddSplit={onAddSplit} onSetSingleSplit={onSetSingleSplit} maxOffset={2} />
                        <SplitSummary splitTotal={splitTotal} sourceAmount={sourceAmount} isOverBudget={isOverBudget} />

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
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Delay Vendor Payments{vendor ? ` — ${vendor}` : ''}</DialogTitle>
                    <DialogDescription>Delay all payments for this vendor from a source month to different payment months.</DialogDescription>
                </DialogHeader>
                {vendor && (
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1 space-y-1.5">
                                <Label>Source Month</Label>
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
                            <div className="flex-1 space-y-1.5">
                                <Label>Total Amount</Label>
                                <div className="bg-muted text-foreground rounded-md border px-3 py-2 text-sm tabular-nums">
                                    ${formatAmount(sourceAmount)}
                                </div>
                            </div>
                        </div>

                        <SplitTable
                            splits={splits}
                            monthOptions={monthOptions}
                            monthColumnLabel="Payment Month"
                            emptyMessage="No delays configured. Add a split to delay payments."
                            monthKey="payment_month"
                            onSplitChange={(index, changes) => onSplitChange(index, changes as Partial<VendorPaymentDelaySplit>)}
                            onRemoveSplit={onRemoveSplit}
                        />

                        <SplitActions onAddSplit={onAddSplit} onSetSingleSplit={onSetSingleSplit} />
                        <SplitSummary splitTotal={splitTotal} sourceAmount={sourceAmount} isOverBudget={isOverBudget} />

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

// Amount Breakdown Modal
type AmountBreakdownModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filter: BreakdownFilter | null;
    breakdownRows: BreakdownRow[];
    costCodeDescriptions?: Record<string, string>;
};

const getBreakdownTitle = (filter: BreakdownFilter | null, costCodeDescriptions?: Record<string, string>): string => {
    if (!filter) return 'Amount Breakdown';
    const flowLabel = filter.flowType === 'cash_in' ? 'Cash In' : 'Cash Out';
    const monthLabel = formatMonthHeader(filter.month);
    if (filter.costItem && filter.jobNumber) {
        const desc = getCostItemLabel(filter.costItem, null, costCodeDescriptions);
        return `${flowLabel} — ${desc} — ${filter.jobNumber} — ${monthLabel}`;
    }
    if (filter.costItem && filter.vendor) {
        const desc = getCostItemLabel(filter.costItem, null, costCodeDescriptions);
        return `${flowLabel} — ${desc} — ${filter.vendor} — ${monthLabel}`;
    }
    if (filter.costItem) {
        const desc = getCostItemLabel(filter.costItem, null, costCodeDescriptions);
        return `${flowLabel} — ${desc} — ${monthLabel}`;
    }
    return `${flowLabel} — ${monthLabel}`;
};

const BREAKDOWN_PAGE_SIZE = 50;

export const AmountBreakdownModal = ({ open, onOpenChange, filter, breakdownRows, costCodeDescriptions }: AmountBreakdownModalProps) => {
    const [page, setPage] = React.useState(0);

    // Reset page when filter changes
    React.useEffect(() => { setPage(0); }, [filter]);

    const filteredRows = React.useMemo(() => {
        if (!filter) return [];
        return breakdownRows.filter((row) => {
            if (row.month !== filter.month) return false;
            if (row.flow_type !== filter.flowType) return false;
            if (filter.costItem && row.cost_item !== filter.costItem) return false;
            if (filter.jobNumber && row.job_number !== filter.jobNumber) return false;
            if (filter.vendor && (row.vendor ?? 'GL') !== filter.vendor) return false;
            return true;
        });
    }, [filter, breakdownRows]);

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / BREAKDOWN_PAGE_SIZE));
    const paginatedRows = filteredRows.slice(page * BREAKDOWN_PAGE_SIZE, (page + 1) * BREAKDOWN_PAGE_SIZE);

    const groupedByCostItem = React.useMemo(() => {
        const groups = new Map<string, { description: string | null; rows: BreakdownRow[]; total: number }>();
        paginatedRows.forEach((row) => {
            const key = row.cost_item;
            if (!groups.has(key)) {
                groups.set(key, {
                    description: row.cost_item_description ?? costCodeDescriptions?.[key] ?? null,
                    rows: [],
                    total: 0,
                });
            }
            const group = groups.get(key)!;
            group.rows.push(row);
            group.total += row.amount;
        });
        return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [paginatedRows, costCodeDescriptions]);

    const grandTotal = filteredRows.reduce((sum, r) => sum + r.amount, 0);
    const grandExGst = filteredRows.reduce((sum, r) => sum + r.ex_gst_amount, 0);
    const grandGst = filteredRows.reduce((sum, r) => sum + r.gst_amount, 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="text-base">{getBreakdownTitle(filter, costCodeDescriptions)}</DialogTitle>
                </DialogHeader>
                {filteredRows.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center text-sm">No breakdown data available for this cell</div>
                ) : (
                    <ScrollArea className="max-h-[70vh]">
                        <div className="space-y-4 sm:space-y-6 pr-4">
                            {/* Summary bar */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                                    <div className="text-muted-foreground text-[9px] sm:text-[11px] font-medium">Ex-GST</div>
                                    <div className="text-foreground text-xs sm:text-sm font-semibold tabular-nums">${formatAmount(grandExGst)}</div>
                                </div>
                                <div className="rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                                    <div className="text-muted-foreground text-[9px] sm:text-[11px] font-medium">GST</div>
                                    <div className="text-foreground text-xs sm:text-sm font-semibold tabular-nums">${formatAmount(grandGst)}</div>
                                </div>
                                <div className="rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                                    <div className="text-muted-foreground text-[9px] sm:text-[11px] font-medium">Total</div>
                                    <div className="text-foreground text-xs sm:text-sm font-semibold tabular-nums">${formatAmount(grandTotal)}</div>
                                </div>
                            </div>

                            {/* Breakdown by cost item */}
                            {groupedByCostItem.map(([costItem, group]) => (
                                <div key={costItem}>
                                    {!filter?.costItem && (
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                                                    {costItem}
                                                </span>
                                                <span className="text-sm font-medium">
                                                    {getCostItemLabel(costItem, group.description, costCodeDescriptions)}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold tabular-nums">${formatAmount(group.total)}</span>
                                        </div>
                                    )}
                                    <div className="overflow-x-auto rounded-lg border">
                                        <table className="w-full min-w-[600px] text-xs">
                                            <thead>
                                                <tr className="bg-muted/50 text-muted-foreground border-b text-left">
                                                    <th className="px-3 py-2 font-medium">Source Month</th>
                                                    <th className="px-3 py-2 font-medium">Job</th>
                                                    <th className="px-3 py-2 font-medium">Vendor</th>
                                                    <th className="px-3 py-2 font-medium">Rule Applied</th>
                                                    <th className="px-3 py-2 text-right font-medium">Ex-GST</th>
                                                    <th className="px-3 py-2 text-right font-medium">GST</th>
                                                    <th className="px-3 py-2 text-right font-medium">Total</th>
                                                    <th className="px-3 py-2 text-center font-medium">Source</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.rows
                                                    .sort(
                                                        (a, b) =>
                                                            a.source_month.localeCompare(b.source_month) ||
                                                            a.job_number.localeCompare(b.job_number),
                                                    )
                                                    .map((row, idx) => (
                                                        <tr key={idx} className="border-border/50 hover:bg-muted/50 border-b last:border-0">
                                                            <td className="px-3 py-2 font-mono">
                                                                {row.source_month !== row.month ? (
                                                                    <span className="text-muted-foreground italic">
                                                                        {formatMonthHeader(row.source_month)}
                                                                    </span>
                                                                ) : (
                                                                    formatMonthHeader(row.source_month)
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 font-mono">{row.job_number}</td>
                                                            <td className="max-w-[140px] truncate px-3 py-2" title={row.vendor ?? '-'}>
                                                                {row.vendor ?? '-'}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className="text-muted-foreground rounded bg-muted px-1.5 py-0.5">
                                                                    {row.rule}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right tabular-nums">
                                                                ${formatAmount(row.ex_gst_amount)}
                                                            </td>
                                                            <td className="px-3 py-2 text-right tabular-nums">
                                                                {row.gst_amount !== 0 ? `$${formatAmount(row.gst_amount)}` : '-'}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                                                                ${formatAmount(row.amount)}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                <Badge
                                                                    variant={row.source === 'actual' ? 'default' : 'secondary'}
                                                                    className="text-[10px]"
                                                                >
                                                                    {row.source}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                            {group.rows.length > 1 && (
                                                <tfoot>
                                                    <tr className="bg-muted/30 font-medium">
                                                        <td colSpan={4} className="px-3 py-2 text-right">
                                                            Subtotal
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            ${formatAmount(group.rows.reduce((s, r) => s + r.ex_gst_amount, 0))}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            ${formatAmount(group.rows.reduce((s, r) => s + r.gst_amount, 0))}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">${formatAmount(group.total)}</td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
                {filteredRows.length > BREAKDOWN_PAGE_SIZE && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
                        <span className="text-muted-foreground text-[10px] sm:text-xs">
                            {page * BREAKDOWN_PAGE_SIZE + 1}–{Math.min((page + 1) * BREAKDOWN_PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} className="h-7 text-xs">
                                Prev
                            </Button>
                            <span className="text-muted-foreground text-[10px] sm:text-xs">
                                {page + 1}/{totalPages}
                            </span>
                            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} className="h-7 text-xs">
                                Next
                            </Button>
                        </div>
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
        <DialogContent className="flex h-[95vh] max-h-[95vh] w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-none">
            <div className="flex items-center justify-between bg-muted px-3 py-2 sm:px-4 sm:py-2.5">
                <span className="text-xs sm:text-sm font-medium tracking-wide text-foreground uppercase">{title}</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center p-2 sm:p-4">{children}</div>
        </DialogContent>
    </Dialog>
);

// GST Breakdown Modal
type GstBreakdownModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    gstBreakdown: GstQuarterBreakdown[];
};

const GstTransactionTable = ({ transactions, type }: { transactions: GstTransaction[]; type: 'collected' | 'paid' }) => {
    if (transactions.length === 0) {
        return <div className="text-muted-foreground py-4 text-center text-sm">No GST {type} transactions in this quarter</div>;
    }

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
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                {type === 'collected' ? (
                                    <TableHead className="w-[40%] text-xs">Job</TableHead>
                                ) : (
                                    <>
                                        <TableHead className="w-[30%] text-xs">Vendor</TableHead>
                                        <TableHead className="w-[25%] text-xs">Cost Item</TableHead>
                                    </>
                                )}
                                <TableHead className="w-[18%] text-right text-xs">Gross</TableHead>
                                <TableHead className="w-[15%] text-right text-xs">GST</TableHead>
                                <TableHead className="w-[12%] text-center text-xs">Source</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {monthTransactions.map((t, idx) => (
                                <TableRow key={idx}>
                                    {type === 'collected' ? (
                                        <TableCell className="truncate text-xs">{t.job_number || '-'}</TableCell>
                                    ) : (
                                        <>
                                            <TableCell className="truncate text-xs" title={t.vendor || 'N/A'}>
                                                {t.vendor || 'N/A'}
                                            </TableCell>
                                            <TableCell className="truncate text-xs" title={t.cost_item_description || t.cost_item || ''}>
                                                <span className="font-mono">{t.cost_item}</span>
                                            </TableCell>
                                        </>
                                    )}
                                    <TableCell className="text-right text-xs tabular-nums">${formatAmount(t.gross_amount)}</TableCell>
                                    <TableCell className="text-right text-xs font-medium tabular-nums">${formatAmount(t.gst_amount)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={t.source === 'actual' ? 'default' : 'secondary'} className="text-[10px]">
                                            {t.source}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ))}
        </div>
    );
};

export const GstBreakdownModal = ({ open, onOpenChange, gstBreakdown }: GstBreakdownModalProps) => {
    const [selectedQuarter, setSelectedQuarter] = useState(gstBreakdown[0]?.quarter || '');

    const exportToExcel = (quarter: GstQuarterBreakdown) => {
        const wb = XLSX.utils.book_new();

        const collectedData = [
            ['GST COLLECTED (Revenue)'],
            ['Quarter:', quarter.quarter_label],
            [''],
            ['Month', 'Job Number', 'Gross Amount', 'GST Amount', 'Source'],
            ...quarter.collected.transactions.map((t) => [formatMonthHeader(t.month), t.job_number || '-', t.gross_amount, t.gst_amount, t.source]),
            [''],
            ['', 'SUBTOTAL', quarter.collected.transactions.reduce((sum, t) => sum + t.gross_amount, 0), quarter.collected.total, ''],
        ];
        const wsCollected = XLSX.utils.aoa_to_sheet(collectedData);
        wsCollected['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsCollected, 'GST Collected');

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

        XLSX.writeFile(wb, `GST_Breakdown_${quarter.quarter_label.replace(' ', '_')}.xlsx`);
    };

    if (gstBreakdown.length === 0) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>GST Breakdown</DialogTitle>
                        <DialogDescription>Quarterly GST breakdown and transaction details.</DialogDescription>
                    </DialogHeader>
                    <div className="text-muted-foreground py-8 text-center">No GST data available for the forecast period</div>
                </DialogContent>
            </Dialog>
        );
    }

    const currentQuarter = gstBreakdown.find((q) => q.quarter === selectedQuarter) || gstBreakdown[0];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] sm:max-w-5xl">
                <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <DialogTitle className="text-sm sm:text-base">GST Breakdown by Quarter</DialogTitle>
                        <DialogDescription className="text-xs hidden sm:block">Review collected and paid GST per quarter with transaction-level detail.</DialogDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 self-start sm:self-auto h-7 sm:h-8 text-xs" onClick={() => exportToExcel(currentQuarter)}>
                        <Download className="h-3.5 w-3.5" />
                        Export
                    </Button>
                </DialogHeader>
                <Tabs value={selectedQuarter} onValueChange={setSelectedQuarter} className="w-full">
                    <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
                        {gstBreakdown.map((q) => (
                            <TabsTrigger key={q.quarter} value={q.quarter} className="text-[10px] sm:text-xs whitespace-nowrap px-2 sm:px-3 py-1 sm:py-1.5">
                                {q.quarter_label}
                                <span className={`ml-1 sm:ml-2 text-[8px] sm:text-[10px] ${q.net >= 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                    {q.net >= 0 ? 'Pay' : 'Ref'}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {gstBreakdown.map((q) => (
                        <TabsContent key={q.quarter} value={q.quarter} className="mt-4">
                            <div className="mb-3 sm:mb-4 grid grid-cols-3 gap-1.5 sm:gap-3">
                                <div className="rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                                    <div className="text-muted-foreground text-[9px] sm:text-[11px] font-medium">Collected</div>
                                    <div className="text-foreground text-xs sm:text-sm font-semibold tabular-nums">
                                        ${formatAmount(q.collected.total)}
                                    </div>
                                    <div className="text-muted-foreground text-[8px] sm:text-[10px]">{q.collected.transactions.length} txns</div>
                                </div>
                                <div className="rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                                    <div className="text-muted-foreground text-[9px] sm:text-[11px] font-medium">Paid</div>
                                    <div className="text-foreground text-xs sm:text-sm font-semibold tabular-nums">
                                        ${formatAmount(q.paid.total)}
                                    </div>
                                    <div className="text-muted-foreground text-[8px] sm:text-[10px]">{q.paid.transactions.length} txns</div>
                                </div>
                                <div className="rounded-md border px-2 sm:px-3 py-1.5 sm:py-2">
                                    <div className="text-muted-foreground text-[9px] sm:text-[11px] font-medium">
                                        {q.net >= 0 ? 'Payable' : 'Refund'}
                                    </div>
                                    <div className={`text-xs sm:text-sm font-semibold tabular-nums ${q.net >= 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        ${formatAmount(Math.abs(q.net))}
                                    </div>
                                    <div className="text-muted-foreground text-[8px] sm:text-[10px]">Due: {formatMonthHeader(q.pay_month)}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                                <div className="min-w-0 space-y-1.5 sm:space-y-2">
                                    <Label className="text-muted-foreground text-[10px] sm:text-xs">GST Collected (Revenue)</Label>
                                    <ScrollArea className="h-[200px] sm:h-[350px] rounded-md border p-2 sm:p-3">
                                        <div className="min-w-full overflow-x-auto">
                                            <GstTransactionTable transactions={q.collected.transactions} type="collected" />
                                        </div>
                                    </ScrollArea>
                                </div>
                                <div className="min-w-0 space-y-1.5 sm:space-y-2">
                                    <Label className="text-muted-foreground text-[10px] sm:text-xs">GST Paid (Costs)</Label>
                                    <ScrollArea className="h-[200px] sm:h-[350px] rounded-md border p-2 sm:p-3">
                                        <div className="min-w-full overflow-x-auto">
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

// Retention Settings Modal
type RetentionSettingsModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    retentionSummary: RetentionSetting[];
};

export const RetentionSettingsModal = ({ open, onOpenChange, retentionSummary }: RetentionSettingsModalProps) => {
    const [editingJob, setEditingJob] = useState<string | null>(null);
    const [editRate, setEditRate] = useState(0);
    const [editCap, setEditCap] = useState(0);
    const [editReleaseDate, setEditReleaseDate] = useState('');
    const [confirmResetJob, setConfirmResetJob] = useState<string | null>(null);

    const startEdit = (job: RetentionSetting) => {
        setEditingJob(job.job_number);
        setEditRate(job.retention_rate);
        setEditCap(job.retention_cap_pct);
        setEditReleaseDate(job.release_date ?? '');
    };

    const cancelEdit = () => {
        setEditingJob(null);
    };

    const saveEdit = (jobNumber: string) => {
        router.post(
            '/cash-forecast/retention-settings',
            {
                job_number: jobNumber,
                retention_rate: editRate,
                retention_cap_pct: editCap,
                release_date: editReleaseDate || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => setEditingJob(null),
                onError: (errors) => toast.error(Object.values(errors).flat().join(', ') || 'Failed to save retention settings'),
            },
        );
    };

    const resetToAuto = (jobNumber: string) => {
        router.delete(`/cash-forecast/retention-settings/${jobNumber}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingJob(null);
                setConfirmResetJob(null);
            },
            onError: (errors) => toast.error(Object.values(errors).flat().join(', ') || 'Failed to reset retention settings'),
        });
    };

    return (
    <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Retention Settings</DialogTitle>
                    <DialogDescription>
                        Retention rates per job, auto-inferred from Premier ERP progress billing data. Override to set custom rates.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh]">
                    <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Job</TableHead>
                                <TableHead className="text-right text-xs">Rate %</TableHead>
                                <TableHead className="text-right text-xs">Cap %</TableHead>
                                <TableHead className="text-right text-xs">Contract</TableHead>
                                <TableHead className="text-right text-xs">Retained</TableHead>
                                <TableHead className="text-xs">Cap Status</TableHead>
                                <TableHead className="text-xs">Release</TableHead>
                                <TableHead className="text-xs">Source</TableHead>
                                <TableHead className="w-[80px] text-xs">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {retentionSummary.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                                        No jobs with retention data found. Retention data is loaded from Premier ERP progress billing summaries.
                                    </TableCell>
                                </TableRow>
                            )}
                            {retentionSummary.map((job) => {
                                const isEditing = editingJob === job.job_number;
                                return (
                                    <TableRow key={job.job_number}>
                                        <TableCell className="font-mono text-sm">{job.job_number}</TableCell>
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    value={editRate}
                                                    onChange={(e) => setEditRate(Number(e.target.value))}
                                                    className="h-8 w-20 text-right"
                                                />
                                            ) : (
                                                `${job.retention_rate.toFixed(1)}%`
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="100"
                                                    value={editCap}
                                                    onChange={(e) => setEditCap(Number(e.target.value))}
                                                    className="h-8 w-20 text-right"
                                                />
                                            ) : (
                                                `${job.retention_cap_pct.toFixed(1)}%`
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {job.contract_sum > 0 ? `$${formatAmount(job.contract_sum)}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm">
                                            {job.retainage_to_date > 0 ? `$${formatAmount(job.retainage_to_date)}` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {job.cap_reached ? (
                                                <Badge variant="secondary">
                                                    Cap Reached
                                                </Badge>
                                            ) : job.contract_sum > 0 ? (
                                                <Badge variant="outline">
                                                    {((job.retainage_to_date / (job.contract_sum * (job.retention_cap_pct / 100))) * 100).toFixed(0)}% of
                                                    cap
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="date"
                                                    value={editReleaseDate}
                                                    onChange={(e) => setEditReleaseDate(e.target.value)}
                                                    className="h-8 w-36"
                                                />
                                            ) : job.release_date ? (
                                                <span className="text-sm">{job.release_date}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Not set</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={job.is_auto ? 'outline' : 'default'} className="text-xs">
                                                {job.is_auto ? 'Auto' : 'Override'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {isEditing ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(job.job_number)}>
                                                            <Save className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(job)}>
                                                            Edit
                                                        </Button>
                                                        {!job.is_auto && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => setConfirmResetJob(job.job_number)}
                                                                title="Reset to auto-inferred"
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    </div>
                </ScrollArea>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <p className="text-muted-foreground mr-auto text-[10px] sm:text-xs">
                        Auto rates inferred from Premier ERP. Override to set custom terms.
                    </p>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-xs">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={confirmResetJob !== null} onOpenChange={(open) => { if (!open) setConfirmResetJob(null); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset to Auto-Inferred Rate?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove the manual override for job {confirmResetJob} and revert to the rate inferred from Premier ERP billing data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => confirmResetJob && resetToAuto(confirmResetJob)}>
                        Reset to Auto
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
    );
};
