import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ChartColumnIncreasing,
    CirclePlus,
    ClockAlert,
    Code2,
    DollarSign,
    EllipsisVertical,
    ExternalLink,
    FileImage,
    FolderTree,
    Hash,
    Heart,
    Layers,
    Pencil,
    RotateCcw,
    Star,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type LocationTab = 'sublocations' | 'cost-codes' | 'price-list' | 'favourites';

const TABS: { key: LocationTab; label: string; icon: typeof FolderTree; countKey: string }[] = [
    { key: 'sublocations', label: 'Sub-locations', icon: FolderTree, countKey: 'sublocations' },
    { key: 'cost-codes', label: 'Cost Codes', icon: Code2, countKey: 'cost_codes' },
    { key: 'price-list', label: 'Price List', icon: DollarSign, countKey: 'price_list' },
    { key: 'favourites', label: 'Favorites', icon: Heart, countKey: 'favourites' },
];

export type LocationBase = {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
    external_id: string;
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
    };
};

interface LocationLayoutProps {
    location: LocationBase;
    activeTab: LocationTab;
    children: ReactNode;
}

export default function LocationLayout({ location, activeTab, children }: LocationLayoutProps) {
    const { flash } = usePage<{ flash: { success?: string } }>().props;
    const [openDialog, setOpenDialog] = useState(false);

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
                            Create a new sub-location for <span className="font-medium">{location.name}</span>. This will be synced to
                            Employment Hero.
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
                {/* Location Details Card */}
                <div className="grid gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <CardTitle className="text-base">Location Details</CardTitle>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <EllipsisVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
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
                                        <Link href={`/location/${location.id}/job-data`} method="get" className="gap-2">
                                            <RotateCcw className="h-4 w-4" />
                                            Load Job Cost
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="gap-2" onSelect={() => setOpenDialog(true)}>
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
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <Hash className="h-4 w-4" />
                                        Location ID
                                    </div>
                                    <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{location.eh_location_id}</code>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <ExternalLink className="h-4 w-4" />
                                        External ID
                                    </div>
                                    {location.external_id ? (
                                        <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{location.external_id}</code>
                                    ) : (
                                        <span className="text-muted-foreground text-sm italic">Not set</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
                                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                                        <Layers className="h-4 w-4" />
                                        Parent ID
                                    </div>
                                    <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{location.eh_parent_id}</code>
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
                </div>

                {/* Tab Navigation */}
                <div className="space-y-4">
                    <div className="bg-muted inline-flex h-auto items-center justify-start rounded-lg p-1">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const count = location.tab_counts?.[tab.countKey as keyof typeof location.tab_counts] ?? 0;
                            const isActive = activeTab === tab.key;

                            return (
                                <Link
                                    key={tab.key}
                                    href={getTabHref(tab.key)}
                                    className={cn(
                                        'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-all sm:gap-2 sm:px-3',
                                        isActive
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    {children}
                </div>
            </div>
        </AppLayout>
    );
}
