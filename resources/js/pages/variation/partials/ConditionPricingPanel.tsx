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
    type: 'linear' | 'area' | 'count';
    height?: number | null;
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

    // Natural measurement unit based on condition type
    const getNaturalUnit = (c?: Condition): string => {
        if (!c) return 'EA';
        if (c.type === 'linear') return 'LM';
        if (c.type === 'area') return 'm2';
        return c.condition_type?.unit ?? 'EA';
    };
    const unit = getNaturalUnit(selectedCondition);
    const isLinearWithHeight = selectedCondition?.type === 'linear' && selectedCondition?.height && selectedCondition.height > 0;
    const rateUnit = selectedCondition?.condition_type?.unit ?? 'm2';

    const handleAdd = () => {
        if (!selectedConditionId || !qty || parseFloat(qty) <= 0) return;
        const condition = filteredConditions.find((c) => String(c.id) === selectedConditionId);
        if (!condition) return;

        onAdd(condition.id, parseFloat(qty), condition.name, unit);
        setSelectedConditionId('');
        setQty('');
    };

    return (
        <div className="bg-muted/50 rounded-lg border p-4">
            <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
                Add from Condition
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <Label className="text-muted-foreground mb-1 text-xs">Condition</Label>
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
                                        <span className="text-muted-foreground text-xs">
                                            ({getNaturalUnit(c)})
                                            {c.type === 'linear' && c.height && c.height > 0 && (
                                                <span className="ml-1 text-purple-400">&rarr; {c.condition_type?.unit ?? 'm2'}</span>
                                            )}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full sm:w-32">
                    <Label className="text-muted-foreground mb-1 text-xs">
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
                    {isLinearWithHeight && qty && parseFloat(qty) > 0 && (
                        <div className="text-muted-foreground mt-1 text-[10px]">
                            = {(parseFloat(qty) * (selectedCondition?.height ?? 1)).toFixed(2)} {rateUnit} (&times;{selectedCondition?.height}m H)
                        </div>
                    )}
                </div>
                <Button
                    onClick={handleAdd}
                    size="sm"
                    disabled={!selectedConditionId || !qty || parseFloat(qty) <= 0 || loading}
                    className="h-9 w-full gap-1.5 sm:w-auto"
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
