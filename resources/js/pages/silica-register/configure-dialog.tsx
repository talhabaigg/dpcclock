import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Plus, Settings } from 'lucide-react';
import { useState } from 'react';

interface SilicaOption {
    id: number;
    type: string;
    label: string;
    active: boolean;
    sort_order: number;
}

interface Props {
    options: {
        tasks: SilicaOption[];
        control_measures: SilicaOption[];
        respirators: SilicaOption[];
    };
}

function OptionSection({ type, label, items }: { type: string; label: string; items: SilicaOption[] }) {
    const [newLabel, setNewLabel] = useState('');
    const [adding, setAdding] = useState(false);

    const handleAdd = () => {
        if (!newLabel.trim()) return;
        router.post(route('silica-register.options.store'), { type, label: newLabel.trim() }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => { setNewLabel(''); setAdding(false); },
        });
    };

    const handleToggle = (option: SilicaOption) => {
        router.put(route('silica-register.options.update', option.id), { active: !option.active }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const handleMove = (option: SilicaOption, direction: 'up' | 'down') => {
        const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
        const idx = sorted.findIndex((o) => o.id === option.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        const reordered = sorted.map((o, i) => {
            if (i === idx) return { id: o.id, sort_order: sorted[swapIdx].sort_order };
            if (i === swapIdx) return { id: o.id, sort_order: sorted[idx].sort_order };
            return { id: o.id, sort_order: o.sort_order };
        });

        router.post(route('silica-register.options.reorder'), { options: reordered }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{label}</Label>
                <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                </Button>
            </div>

            {adding && (
                <div className="flex gap-2">
                    <Input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder={`New ${label.toLowerCase().slice(0, -1)}...`}
                        className="text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button size="sm" onClick={handleAdd}>Add</Button>
                </div>
            )}

            <div className="space-y-1">
                {sorted.map((option, idx) => (
                    <div
                        key={option.id}
                        className={cn(
                            'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                            !option.active && 'opacity-50',
                        )}
                    >
                        <Switch
                            checked={option.active}
                            onCheckedChange={() => handleToggle(option)}
                            className="scale-75"
                        />
                        <span className="min-w-0 flex-1 break-words">{option.label}</span>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={idx === 0}
                                onClick={() => handleMove(option, 'up')}
                            >
                                <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={idx === sorted.length - 1}
                                onClick={() => handleMove(option, 'down')}
                            >
                                <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                ))}
                {sorted.length === 0 && (
                    <p className="text-muted-foreground py-2 text-center text-xs">No options configured</p>
                )}
            </div>
        </div>
    );
}

export default function ConfigureDialog({ options }: Props) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-4 top-4 left-4 right-4 bottom-4 max-w-none -translate-x-0 -translate-y-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:right-auto sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Configure Silica Options</DialogTitle>
                </DialogHeader>
                <div className="flex-1 space-y-6 overflow-y-auto py-4">
                    <OptionSection type="task" label="Tasks" items={options.tasks} />
                    <hr />
                    <OptionSection type="control_measure" label="Control Measures" items={options.control_measures} />
                    <hr />
                    <OptionSection type="respirator" label="Respirator Types" items={options.respirators} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
