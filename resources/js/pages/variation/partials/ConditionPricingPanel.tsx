import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Settings } from 'lucide-react';
import { useState } from 'react';

export interface Condition {
    id: number;
    name: string;
    location_id: number;
    pricing_method: string;
    labour_unit_rate?: number;
    unit_rate_multiplier?: number;
    condition_type?: {
        id: number;
        name: string;
        unit: string;
        color: string;
    } | null;
}

interface ConditionPricingPanelProps {
    conditions: Condition[];
    locationId: string;
    onAdd: (conditionId: number, qty: number, description: string, unit: string) => void;
    loading?: boolean;
    onManageConditions?: () => void;
}

export default function ConditionPricingPanel({ conditions, locationId, onAdd, loading, onManageConditions }: ConditionPricingPanelProps) {
    const [selectedConditionId, setSelectedConditionId] = useState<string>('');
    const [qty, setQty] = useState<string>('');

    const filteredConditions = conditions.filter((c) => String(c.location_id) === locationId);
    const selectedCondition = filteredConditions.find((c) => String(c.id) === selectedConditionId);
    const unit = selectedCondition?.condition_type?.unit ?? 'EA';

    const handleAdd = () => {
        if (!selectedConditionId || !qty || parseFloat(qty) <= 0) return;
        const condition = filteredConditions.find((c) => String(c.id) === selectedConditionId);
        if (!condition) return;

        onAdd(condition.id, parseFloat(qty), condition.name, unit);
        setSelectedConditionId('');
        setQty('');
    };

    return (
        <div className="rounded-lg border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-700/60 dark:bg-slate-800/30">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Add from Condition
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <Label className="mb-1 text-xs text-slate-600 dark:text-slate-400">Condition</Label>
                    <Select value={selectedConditionId} onValueChange={setSelectedConditionId}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select condition..." />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredConditions.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    <div className="flex items-center gap-2">
                                        {c.condition_type && (
                                            <span
                                                className="inline-block h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: c.condition_type.color }}
                                            />
                                        )}
                                        <span>{c.name}</span>
                                        <span className="text-xs text-slate-400">
                                            ({c.condition_type?.unit ?? 'EA'})
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-32">
                    <Label className="mb-1 text-xs text-slate-600 dark:text-slate-400">
                        Qty ({unit})
                    </Label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="0.00"
                        className="h-9"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                </div>
                <Button
                    onClick={handleAdd}
                    size="sm"
                    disabled={!selectedConditionId || !qty || parseFloat(qty) <= 0 || loading}
                    className="h-9 gap-1.5"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                </Button>
                {onManageConditions && (
                    <Button
                        onClick={onManageConditions}
                        size="sm"
                        variant="outline"
                        className="h-9 gap-1.5"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Manage
                    </Button>
                )}
            </div>
        </div>
    );
}
