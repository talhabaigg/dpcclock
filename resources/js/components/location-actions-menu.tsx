import { Button } from '@/components/ui/button';
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
import { Link, router, useForm, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ChartColumnIncreasing,
    CirclePlus,
    Clock,
    ClockAlert,
    Download,
    EllipsisVertical,
    FileImage,
    FlaskConical,
    GitBranch,
    Loader2,
    Lock,
    Pencil,
    RotateCcw,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

type ConfirmState = {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
};

type Props = {
    location: {
        id: number;
        name: string;
        closed_at?: string | null;
    };
};

export default function LocationActionsMenu({ location }: Props) {
    const { can } = usePage<{ can?: { closeProjects?: boolean } }>().props;
    const canClose = can?.closeProjects ?? false;

    const [openDialog, setOpenDialog] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [busyMessage, setBusyMessage] = useState<string | null>(null);

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

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        Actions
                        <EllipsisVertical className="ml-1.5 h-3.5 w-3.5" />
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
                                <DropdownMenuItem className="text-destructive focus:text-destructive gap-2" onClick={handleClose}>
                                    <Lock className="h-4 w-4" />
                                    Close Project
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

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
        </>
    );
}
