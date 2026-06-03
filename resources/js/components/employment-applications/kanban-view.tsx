import { Badge } from '@/components/ui/badge';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Link } from '@inertiajs/react';
import { AlertTriangle, GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface EmploymentApplication {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    phone: string;
    occupation: string;
    occupation_other: string | null;
    suburb: string;
    latitude: number | null;
    longitude: number | null;
    status: string;
    created_at: string;
    duplicate_count: number;
}

export function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function appNumber(id: number) {
    return `ENQ-${String(id).padStart(4, '0')}`;
}

export function occupationLabel(app: EmploymentApplication) {
    if (app.occupation === 'other' && app.occupation_other) {
        return app.occupation_other.length > 40 ? app.occupation_other.slice(0, 40) + '…' : app.occupation_other;
    }
    return app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);
}

function CardContent({ app }: { app: EmploymentApplication }) {
    return (
        <>
            <div className="flex items-start justify-between gap-1">
                <span className="truncate text-xs font-medium leading-tight">
                    {app.first_name} {app.surname}
                </span>
                {app.duplicate_count > 0 && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
            </div>
            <p className="text-muted-foreground text-xs font-mono">{appNumber(app.id)}</p>
            <p className="text-muted-foreground truncate text-xs">{occupationLabel(app)}</p>
            {app.suburb && <p className="text-muted-foreground truncate text-xs">{app.suburb}</p>}
            <p className="text-muted-foreground mt-0.5 text-xs">{formatDate(app.created_at)}</p>
        </>
    );
}

function KanbanCard({ app }: { app: EmploymentApplication }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: app.id,
        data: { app },
    });

    const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-background rounded-md border transition-opacity ${isDragging ? 'opacity-30' : ''}`}
        >
            <div className="flex items-start gap-1 p-1.5">
                <button
                    className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    tabIndex={-1}
                >
                    <GripVertical size={11} />
                </button>
                <Link href={`/employment-applications/${app.id}`} className="min-w-0 flex-1">
                    <CardContent app={app} />
                </Link>
            </div>
        </div>
    );
}

function KanbanLane({ status, apps, labels }: { status: string; apps: EmploymentApplication[]; labels: Record<string, string> }) {
    const { setNodeRef, isOver } = useDroppable({ id: status });
    const label = labels[status] ?? status;

    return (
        <div
            className={`flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors ${isOver ? 'bg-primary/5' : 'bg-muted/20'}`}
        >
            <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5">
                <span className="truncate text-xs font-semibold" title={label}>
                    {label}
                </span>
                <Badge variant="secondary" className="ml-1 h-4 shrink-0 rounded-full px-1.5 text-xs leading-none overflow-hidden">
                    {apps.length}
                </Badge>
            </div>
            <div ref={setNodeRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                {apps.length === 0 ? (
                    <div className="text-muted-foreground flex h-12 items-center justify-center text-xs">Empty</div>
                ) : (
                    apps.map((app) => <KanbanCard key={app.id} app={app} />)
                )}
            </div>
        </div>
    );
}

export function KanbanView({
    applications,
    statuses,
    onStatusChange,
}: {
    applications: EmploymentApplication[];
    statuses: Record<string, string>;
    onStatusChange: (id: number, newStatus: string) => void;
}) {
    const [activeApp, setActiveApp] = useState<EmploymentApplication | null>(null);

    const statusKeys = useMemo(() => Object.keys(statuses), [statuses]);

    const grouped = useMemo(() => {
        const map: Record<string, EmploymentApplication[]> = {};
        statusKeys.forEach((s) => (map[s] = []));
        applications.forEach((app) => {
            if (map[app.status] !== undefined) map[app.status].push(app);
        });
        return map;
    }, [applications, statusKeys]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const handleDragStart = (event: DragStartEvent) => {
        setActiveApp(applications.find((a) => a.id === event.active.id) ?? null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveApp(null);
        const { active, over } = event;
        if (!over) return;
        const newStatus = over.id as string;
        const app = applications.find((a) => a.id === active.id);
        if (!app || app.status === newStatus) return;
        onStatusChange(app.id, newStatus);
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* grid: each lane gets an equal share — height fills the parent */}
            <div
                className="grid h-full min-h-0 gap-1.5 overflow-hidden"
                style={{ gridTemplateColumns: `repeat(${statusKeys.length}, minmax(0, 1fr))` }}
            >
                {statusKeys.map((status) => (
                    <KanbanLane key={status} status={status} apps={grouped[status]} labels={statuses} />
                ))}
            </div>

            <DragOverlay>
                {activeApp && (
                    <div className="bg-background w-40 rotate-1 rounded-md border p-1.5 shadow-xl">
                        <CardContent app={activeApp} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
