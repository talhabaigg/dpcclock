import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ChartColumnIncreasing,
    CirclePlus,
    Clock,
    ClockAlert,
    Code2,
    DollarSign,
    Download,
    EllipsisVertical,
    FileImage,
    FlaskConical,
    FolderTree,
    GitBranch,
    Heart,
    Loader2,
    Lock,
    Pencil,
    RotateCcw,
    Star,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type LocationTab = 'sublocations' | 'cost-codes' | 'price-list' | 'favourites' | 'production-data' | 'schedule';

const formatVA = (n: number) => `VA-${String(n).padStart(3, '0')}`;

function IdChip({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            {value ? (
                <code className="bg-muted rounded px-2 py-0.5 font-mono text-xs">{value}</code>
            ) : (
                <span className="text-muted-foreground text-xs italic">Not set</span>
            )}
        </div>
    );
}

const TABS: { key: LocationTab; label: string; icon: typeof FolderTree; countKey: string; permissionKey?: string }[] = [
    { key: 'sublocations', label: 'Sub-locations', icon: FolderTree, countKey: 'sublocations' },
    { key: 'cost-codes', label: 'Cost Codes', icon: Code2, countKey: 'cost_codes', permissionKey: 'cost_codes' },
    { key: 'price-list', label: 'Price List', icon: DollarSign, countKey: 'price_list', permissionKey: 'price_list' },
    { key: 'favourites', label: 'Favorites', icon: Heart, countKey: 'favourites', permissionKey: 'favourites' },
    { key: 'production-data', label: 'DPC Data', icon: ChartColumnIncreasing, countKey: 'production_data', permissionKey: 'production_data' },
    { key: 'schedule', label: 'Schedule', icon: CalendarDays, countKey: 'tasks', permissionKey: 'schedule' },
];

export type LocationBase = {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
    external_id: string;
    closed_at?: string | null;
    variation_number_start: number | null;
    variation_next_number: number | null;
    sell_multiplier_percentage: number | string | null;
    worktypes: Array<{
        id: number;
        name: string;
        eh_worktype_id: string;
    }>;
    tab_counts: {
        sublocations: number;
        cost_codes: number;
        price_list: number;
        favourites: number;
        production_data: number;
        tasks: number;
    };
    tab_permissions: {
        cost_codes: boolean;
        price_list: boolean;
        favourites: boolean;
        production_data: boolean;
        schedule: boolean;
    };
};

interface LocationLayoutProps {
    location: LocationBase;
    activeTab: LocationTab;
    children: ReactNode;
}

type ConfirmState = {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
};

export default function LocationLayout({ location, activeTab, children }: LocationLayoutProps) {
    const { flash, auth, can } = usePage<{
        flash: { success?: string };
        auth: { isAdmin: boolean };
        can?: { closeProjects?: boolean };
    }>().props;
    const canClose = can?.closeProjects ?? false;
    const [openDialog, setOpenDialog] = useState(false);
    const [editingVarStart, setEditingVarStart] = useState(false);
    const [varStartInput, setVarStartInput] = useState(String(location.variation_number_start ?? ''));
    const [savingVarStart, setSavingVarStart] = useState(false);
    const [editingSellMultiplier, setEditingSellMultiplier] = useState(false);
    const [sellMultiplierInput, setSellMultiplierInput] = useState(
        location.sell_multiplier_percentage != null ? String(location.sell_multiplier_percentage) : '',
    );
    const [savingSellMultiplier, setSavingSellMultiplier] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [busyMessage, setBusyMessage] = useState<string | null>(null);

    const handleClose = () => {
        setConfirm({
            title: 'Close Project',
            description: (
                <>
                    Close <strong>{location.name}</strong>? This hides the project and its data from listing views. You can reopen it later.
                </>
            ),
            confirmLabel: 'Close Project',
            destructive: true,
            onConfirm: () => {
                setConfirm(null);
                setBusyMessage('Closing project...');
                router.post(
                    `/locations/${location.id}/close`,
                    {},
                    {
                        preserveScroll: true,
                        onFinish: () => setBusyMessage(null),
                    },
                );
            },
        });
    };

    const handleReopen = () => {
        setBusyMessage('Reopening project...');
        router.post(
            `/locations/${location.id}/reopen`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setBusyMessage(null),
            },
        );
    };

    const handleResync = () => {
        setConfirm({
            title: 'Resync Timesheets',
            description: (
                <>
                    Queue a full backfill of timesheets from Employment Hero for <strong>{location.name}</strong>? This pulls the entire history and
                    may take a while.
                </>
            ),
            confirmLabel: 'Queue Resync',
            onConfirm: () => {
                setConfirm(null);
                router.post(`/locations/${location.id}/load-timesheets`, {}, { preserveScroll: true });
            },
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
    ];

    const formData = useForm<{
        level: string | null;
        activity: string | null;
        location_id: number;
    }>({
        level: null,
        activity: null,
        location_id: location.id,
    });

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        router.post('/sub-locations', formData.data, {
            onSuccess: () => {
                formData.reset();
                toast.success('Sub-location created successfully');
            },
            onError: () => {
                toast.error('Error creating sub-location');
            },
        });

        formData.reset();
        setOpenDialog(false);
    };

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

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);

    const getTabHref = (tab: LocationTab) => {
        if (tab === 'sublocations') return `/locations/${location.id}`;
        return `/locations/${location.id}/${tab}`;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Location`} />

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Sub-location</DialogTitle>
                        <DialogDescription>
                            Create a new sub-location for <span className="font-medium">{location.name}</span>. This will be synced to Employment
                            Hero.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleFormSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="level">Level</Label>
                                <Input
                                    id="level"
                                    placeholder="Enter level code"
                                    value={formData.data.level ?? ''}
                                    onChange={(e) => formData.setData('level', e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="activity">Activity</Label>
                                <Input
                                    id="activity"
                                    placeholder="Enter activity code"
                                    value={formData.data.activity ?? ''}
                                    onChange={(e) => formData.setData('activity', e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">Create Sub-location</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col gap-4 p-2 sm:gap-6 sm:p-4 md:p-6">
                <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-base">Location Details</CardTitle>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                        <EllipsisVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-52">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/locations/${location.id}/dashboard`} className="gap-2">
                                            <ChartColumnIncreasing className="h-4 w-4" />
                                            Project Dashboard
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href={`/location/${location.id}/job-forecast`} method="get" className="gap-2">
                                            <ChartColumnIncreasing className="h-4 w-4" />
                                            Job Forecast
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/projects/${location.id}/drawings`} className="gap-2">
                                            <FileImage className="h-4 w-4" />
                                            Drawings
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/locations/${location.id}/variations`} className="gap-2">
                                            <GitBranch className="h-4 w-4" />
                                            Variations
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/locations/${location.id}/schedule`} className="gap-2">
                                            <CalendarDays className="h-4 w-4" />
                                            Schedule
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href={`/locations/${location.id}/sds`} className="gap-2">
                                            <FlaskConical className="h-4 w-4" />
                                            SDS Register
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <a href={`/locations/${location.id}/sds/download`} className="gap-2">
                                            <Download className="h-4 w-4" />
                                            Download SDS PDF
                                        </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="gap-2" onClick={() => setOpenDialog(true)}>
                                        <CirclePlus className="h-4 w-4" />
                                        Create Sub-location
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-muted-foreground text-xs">Admin</DropdownMenuLabel>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/location/${location.id}/material-item-price-list-uploads`} className="gap-2">
                                            <ClockAlert className="h-4 w-4" />
                                            Audit Uploads
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/location/${location.id}/req-header/edit`} className="gap-2">
                                            <Pencil className="h-4 w-4" />
                                            Requisition Header
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="gap-2" onClick={handleResync}>
                                        <Clock className="h-4 w-4" />
                                        Resync Timesheets
                                    </DropdownMenuItem>
                                    {canClose && (
                                        <>
                                            <DropdownMenuSeparator />
                                            {location.closed_at ? (
                                                <DropdownMenuItem className="gap-2" onClick={handleReopen}>
                                                    <RotateCcw className="h-4 w-4" />
                                                    Reopen Project
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive gap-2"
                                                    onClick={handleClose}
                                                >
                                                    <Lock className="h-4 w-4" />
                                                    Close Project
                                                </DropdownMenuItem>
                                            )}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 py-2.5 sm:px-6 sm:py-3">
                                    <IdChip label="Location" value={location.eh_location_id} />
                                    <IdChip label="External" value={location.external_id} />
                                    <IdChip label="Parent" value={location.eh_parent_id} />
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground text-sm">Variation Number Start</div>
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

                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground text-sm">Default Sell Multiplier</div>
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
                                                <span className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">%</span>
                                            </div>
                                            <Button size="sm" className="h-7 px-2" onClick={handleSaveSellMultiplier} disabled={savingSellMultiplier}>
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

                                <div className="px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                                        <Star className="h-4 w-4" />
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
                                                    <TooltipProvider delayDuration={200}>
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
                                                                        <Badge key={worktype.eh_worktype_id} variant="secondary" className="text-xs">
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
                                            <span className="text-muted-foreground text-sm italic">No shift conditions configured</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                <div className="space-y-4">
                    <div className="bg-muted inline-flex h-auto items-center justify-start rounded-lg p-1">
                        {TABS.filter(
                            (tab) => !tab.permissionKey || location.tab_permissions?.[tab.permissionKey as keyof typeof location.tab_permissions],
                        ).map((tab) => {
                            const Icon = tab.icon;
                            const count = location.tab_counts?.[tab.countKey as keyof typeof location.tab_counts] ?? 0;
                            const isActive = activeTab === tab.key;

                            return (
                                <Link
                                    key={tab.key}
                                    href={getTabHref(tab.key)}
                                    className={cn(
                                        'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-all sm:gap-2 sm:px-3',
                                        isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {children}
                </div>
            </div>

            {busyMessage && (
                <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center">
                    <div className="bg-background flex flex-col items-center gap-2 rounded-lg border p-6 shadow-lg">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-sm font-medium">{busyMessage}</p>
                    </div>
                </div>
            )}

            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background w-full max-w-md rounded-lg border p-6 shadow-lg">
                        <h2 className="text-lg font-semibold">{confirm.title}</h2>
                        <p className="text-muted-foreground mt-2 text-sm">{confirm.description}</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setConfirm(null)}>
                                Cancel
                            </Button>
                            <Button variant={confirm.destructive ? 'destructive' : 'default'} onClick={confirm.onConfirm}>
                                {confirm.confirmLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
