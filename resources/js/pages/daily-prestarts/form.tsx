import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchSelect } from '@/components/search-select';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { GripVertical, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Location {
    id: number;
    name: string;
}

interface UserOption {
    id: number;
    name: string;
}

interface Prestart {
    id: string;
    location_id: number;
    work_date: string;
    foreman_id: number | null;
    weather: Record<string, unknown> | null;
    activities: { description: string }[] | null;
    safety_concerns: { description: string }[] | null;
}

interface Props {
    prestart: Prestart | null;
    duplicateFrom?: Prestart | null;
    locations: Location[];
    users: UserOption[];
}

function SortableItem({ id, description, onRemove }: { id: string; description: string; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${isDragging ? 'z-50 border-primary/40 bg-background shadow-lg' : ''}`}
        >
            <button type="button" className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
                <GripVertical className="h-4 w-4" />
            </button>
            <span className="flex-1">{description}</span>
            <button type="button" onClick={onRemove}>
                <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
        </li>
    );
}

export default function DailyPrestartForm({ prestart, duplicateFrom, locations, users }: Props) {
    const isEdit = !!prestart;
    const source = prestart ?? duplicateFrom;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Daily Prestarts', href: '/daily-prestarts' },
        { title: isEdit ? 'Edit Prestart' : duplicateFrom ? 'Duplicate Prestart' : 'New Prestart', href: '#' },
    ];

    const { props } = usePage<{ errors: Record<string, string> }>();
    const errors = props.errors ?? {};
    const { data, setData, processing } = useForm({
        location_id: source?.location_id ? String(source.location_id) : '',
        work_date: source?.work_date ?? new Date().toISOString().slice(0, 10),
        foreman_id: source?.foreman_id ? String(source.foreman_id) : '',
        activities: source?.activities ?? ([] as { description: string }[]),
        safety_concerns: source?.safety_concerns ?? ([] as { description: string }[]),
    });

    const nextId = useRef(
        (source?.activities?.length ?? 0) + (source?.safety_concerns?.length ?? 0) + 1,
    );
    const getId = () => `item-${nextId.current++}`;

    const [activityInput, setActivityInput] = useState('');
    const [safetyConcernInput, setSafetyConcernInput] = useState('');
    const [activityKeys] = useState(() => (source?.activities ?? []).map(() => getId()));
    const [concernKeys] = useState(() => (source?.safety_concerns ?? []).map(() => getId()));

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const addActivity = () => {
        const trimmed = activityInput.trim();
        if (!trimmed) return;
        setData('activities', [...data.activities, { description: trimmed }]);
        activityKeys.push(getId());
        setActivityInput('');
    };

    const addSafetyConcern = () => {
        const trimmed = safetyConcernInput.trim();
        if (!trimmed) return;
        setData('safety_concerns', [...data.safety_concerns, { description: trimmed }]);
        concernKeys.push(getId());
        setSafetyConcernInput('');
    };

    const removeActivity = (i: number) => {
        setData('activities', data.activities.filter((_, idx) => idx !== i));
        activityKeys.splice(i, 1);
    };

    const removeConcern = (i: number) => {
        setData('safety_concerns', data.safety_concerns.filter((_, idx) => idx !== i));
        concernKeys.splice(i, 1);
    };

    const handleActivityDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = activityKeys.indexOf(String(active.id));
        const newIndex = activityKeys.indexOf(String(over.id));
        setData('activities', arrayMove(data.activities, oldIndex, newIndex));
        const moved = arrayMove(activityKeys, oldIndex, newIndex);
        activityKeys.length = 0;
        activityKeys.push(...moved);
    };

    const handleConcernDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = concernKeys.indexOf(String(active.id));
        const newIndex = concernKeys.indexOf(String(over.id));
        setData('safety_concerns', arrayMove(data.safety_concerns, oldIndex, newIndex));
        const moved = arrayMove(concernKeys, oldIndex, newIndex);
        concernKeys.length = 0;
        concernKeys.push(...moved);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('location_id', data.location_id);
        formData.append('work_date', data.work_date);
        if (data.foreman_id) formData.append('foreman_id', data.foreman_id);
        data.activities.forEach((a, i) => {
            formData.append(`activities[${i}][description]`, a.description);
        });
        data.safety_concerns.forEach((s, i) => {
            formData.append(`safety_concerns[${i}][description]`, s.description);
        });

        if (isEdit) {
            formData.append('_method', 'PUT');
            router.post(`/daily-prestarts/${prestart.id}`, formData, {
                forceFormData: true,
                preserveState: true,
                preserveScroll: true,
            });
        } else {
            router.post('/daily-prestarts', formData, {
                forceFormData: true,
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    const locationOptions = locations.map((l) => ({ value: String(l.id), label: l.name }));
    const userOptions = users.map((u) => ({ value: String(u.id), label: u.name }));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? 'Edit Prestart' : 'New Prestart'} />
            <div className="mx-auto min-w-96 max-w-96 space-y-6 p-4 sm:min-w-2xl sm:max-w-2xl">
                <h1 className="text-2xl font-bold">{isEdit ? 'Edit Daily Prestart' : 'Create Daily Prestart'}</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Work Date */}
                    <div>
                        <Label>Work Date *</Label>
                        <Input type="date" value={data.work_date} onChange={(e) => setData('work_date', e.target.value)} />
                        {errors.work_date && <p className="mt-1 text-sm text-destructive">{errors.work_date}</p>}
                    </div>

                    {/* Project */}
                    <div>
                        <Label>Project *</Label>
                        <SearchSelect
                            options={locationOptions}
                            selectedOption={data.location_id}
                            onValueChange={(val) => setData('location_id', val)}
                            optionName="project"
                        />
                        {errors.location_id && <p className="mt-1 text-sm text-destructive">{errors.location_id}</p>}
                    </div>

                    {/* Foreman */}
                    <div>
                        <Label>Foreman</Label>
                        <SearchSelect
                            options={userOptions}
                            selectedOption={data.foreman_id}
                            onValueChange={(val) => setData('foreman_id', val)}
                            optionName="foreman"
                        />
                    </div>

                    {/* Weather */}
                    <div>
                        <Label className="mb-2 block">Weather</Label>
                        <p className="text-xs text-muted-foreground mb-2">Weather will be fetched automatically when the prestart is saved.</p>
                    </div>

                    <Separator />

                    {/* Activities */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-base font-semibold">General Site Works / Activities</h3>
                            <p className="text-sm text-muted-foreground">
                                Program, high risk activities, inspections, exclusion zones, work permits, deliveries, etc.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={activityInput}
                                onChange={(e) => setActivityInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addActivity(); } }}
                                placeholder="Describe activity..."
                                className="flex-1"
                            />
                            <Button type="button" variant="outline" size="icon" onClick={addActivity}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {data.activities.length > 0 && (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActivityDragEnd}>
                                <SortableContext items={activityKeys} strategy={verticalListSortingStrategy}>
                                    <ul className="space-y-1">
                                        {data.activities.map((activity, i) => (
                                            <SortableItem
                                                key={activityKeys[i]}
                                                id={activityKeys[i]}
                                                description={activity.description}
                                                onRemove={() => removeActivity(i)}
                                            />
                                        ))}
                                    </ul>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    <Separator />

                    {/* Safety Concerns */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-base font-semibold">Safety Concerns / Incidents</h3>
                            <p className="text-sm text-muted-foreground">Items to be raised from the previous day.</p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={safetyConcernInput}
                                onChange={(e) => setSafetyConcernInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSafetyConcern(); } }}
                                placeholder="Describe safety concern..."
                                className="flex-1"
                            />
                            <Button type="button" variant="outline" size="icon" onClick={addSafetyConcern}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {data.safety_concerns.length > 0 && (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleConcernDragEnd}>
                                <SortableContext items={concernKeys} strategy={verticalListSortingStrategy}>
                                    <ul className="space-y-1">
                                        {data.safety_concerns.map((concern, i) => (
                                            <SortableItem
                                                key={concernKeys[i]}
                                                id={concernKeys[i]}
                                                description={concern.description}
                                                onRemove={() => removeConcern(i)}
                                            />
                                        ))}
                                    </ul>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={processing}>
                            {isEdit ? 'Update Prestart' : 'Create Daily Prestart'}
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link href="/daily-prestarts">Cancel</Link>
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
