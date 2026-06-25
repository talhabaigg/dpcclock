import LocationPageHeader from '@/components/location-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const formatVA = (n: number) => `VA-${String(n).padStart(3, '0')}`;

function IdRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center justify-between gap-4 px-3 py-2 sm:px-6 sm:py-2.5">
            <div className="text-muted-foreground text-xs">{label}</div>
            {value ? (
                <code className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{value}</code>
            ) : (
                <span className="text-muted-foreground text-xs italic">Not set</span>
            )}
        </div>
    );
}

export default function LocationDetails() {
    const { location, auth } = usePage<{ location: LocationBase; auth: { isAdmin: boolean } }>().props;

    const [editingVarStart, setEditingVarStart] = useState(false);
    const [varStartInput, setVarStartInput] = useState(String(location.variation_number_start ?? ''));
    const [savingVarStart, setSavingVarStart] = useState(false);
    const [editingSellMultiplier, setEditingSellMultiplier] = useState(false);
    const [sellMultiplierInput, setSellMultiplierInput] = useState(
        location.sell_multiplier_percentage != null ? String(location.sell_multiplier_percentage) : '',
    );
    const [savingSellMultiplier, setSavingSellMultiplier] = useState(false);

    const handleSaveVarStart = async () => {
        const num = parseInt(varStartInput);
        if (!varStartInput || isNaN(num) || num < 1) {
            toast.error('Please enter a valid starting number');
            return;
        }
        setSavingVarStart(true);
        try {
            await router.patch(
                `/locations/${location.id}/variation-number-start`,
                { variation_number_start: num },
                {
                    onSuccess: () => {
                        setEditingVarStart(false);
                        toast.success('Variation number start updated');
                    },
                    onError: () => toast.error('Failed to update'),
                    onFinish: () => setSavingVarStart(false),
                },
            );
        } catch {
            setSavingVarStart(false);
        }
    };

    const handleSaveSellMultiplier = async () => {
        const trimmed = sellMultiplierInput.trim();
        const num = trimmed === '' ? null : parseFloat(trimmed);
        if (num !== null && (isNaN(num) || num < 0)) {
            toast.error('Please enter a valid percentage');
            return;
        }
        setSavingSellMultiplier(true);
        try {
            await router.patch(
                `/locations/${location.id}/sell-multiplier`,
                { sell_multiplier_percentage: num },
                {
                    onSuccess: () => {
                        setEditingSellMultiplier(false);
                        toast.success('Sell multiplier updated');
                    },
                    onError: () => toast.error('Failed to update'),
                    onFinish: () => setSavingSellMultiplier(false),
                },
            );
        } catch {
            setSavingSellMultiplier(false);
        }
    };

    return (
        <LocationLayout location={location} activeTab="details">
            <Head title={`Details - ${location.name}`} />

            <LocationPageHeader location={location} title="Location Details" />

            <Card className="py-0">
                <CardContent className="p-0">
                    <div className="divide-y">
                        <IdRow label="Location ID" value={location.eh_location_id} />
                        <IdRow label="External ID" value={location.external_id} />
                        <IdRow label="Parent ID" value={location.eh_parent_id} />

                        <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-2.5">
                            <div className="text-muted-foreground text-xs">Variation Number Start</div>
                            {editingVarStart ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        className="h-7 w-24 text-sm"
                                        value={varStartInput}
                                        onChange={(e) => setVarStartInput(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveVarStart();
                                            if (e.key === 'Escape') setEditingVarStart(false);
                                        }}
                                    />
                                    <Button size="sm" className="h-7 px-2" onClick={handleSaveVarStart} disabled={savingVarStart}>
                                        Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingVarStart(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {location.variation_number_start != null ? (
                                        <>
                                            <code className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
                                                {formatVA(location.variation_number_start)}
                                            </code>
                                            {location.variation_next_number != null &&
                                                location.variation_next_number !== location.variation_number_start && (
                                                    <span className="text-muted-foreground text-xs">
                                                        next {formatVA(location.variation_next_number)}
                                                    </span>
                                                )}
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">Not set</span>
                                    )}
                                    {auth.isAdmin && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => {
                                                setVarStartInput(String(location.variation_number_start ?? ''));
                                                setEditingVarStart(true);
                                            }}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-2.5">
                            <div className="text-muted-foreground text-xs">Default Sell Multiplier</div>
                            {editingSellMultiplier ? (
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            className="h-7 w-24 pr-6 text-sm"
                                            value={sellMultiplierInput}
                                            onChange={(e) => setSellMultiplierInput(e.target.value)}
                                            autoFocus
                                            placeholder="220"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveSellMultiplier();
                                                if (e.key === 'Escape') setEditingSellMultiplier(false);
                                            }}
                                        />
                                        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs">
                                            %
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={handleSaveSellMultiplier}
                                        disabled={savingSellMultiplier}
                                    >
                                        Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingSellMultiplier(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {location.sell_multiplier_percentage != null ? (
                                        <code className="bg-muted rounded px-2 py-0.5 font-mono text-xs">
                                            {Number(location.sell_multiplier_percentage)}%
                                        </code>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">Not set</span>
                                    )}
                                    {auth.isAdmin && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => {
                                                setSellMultiplierInput(
                                                    location.sell_multiplier_percentage != null
                                                        ? String(location.sell_multiplier_percentage)
                                                        : '',
                                                );
                                                setEditingSellMultiplier(true);
                                            }}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-3 py-2 sm:px-6 sm:py-2.5">
                            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
                                <Star className="h-3.5 w-3.5" />
                                Shift Conditions
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {location.worktypes?.length > 0 ? (
                                    <>
                                        {location.worktypes.slice(0, 3).map((worktype) => (
                                            <Badge key={worktype.eh_worktype_id} variant="secondary" className="text-xs">
                                                {worktype.name}
                                            </Badge>
                                        ))}
                                        {location.worktypes.length > 3 && (
                                            <TooltipProvider delay={200}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge variant="outline" className="text-muted-foreground cursor-pointer text-xs">
                                                            +{location.worktypes.length - 3} more
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="max-w-xs p-3">
                                                        <p className="mb-2 text-xs font-medium">All Shift Conditions</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {location.worktypes.map((worktype) => (
                                                                <Badge
                                                                    key={worktype.eh_worktype_id}
                                                                    variant="secondary"
                                                                    className="text-xs"
                                                                >
                                                                    {worktype.name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-muted-foreground text-xs italic">No shift conditions configured</span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </LocationLayout>
    );
}
