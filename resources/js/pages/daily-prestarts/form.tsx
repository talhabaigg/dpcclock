import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { SearchSelect } from '@/components/search-select';
import { TimePicker } from '@/components/time-picker';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, GripVertical, GraduationCap, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Location {
    id: number;
    name: string;
}

interface EmployeeOption {
    id: number;
    name: string;
}

interface TrainingData {
    id?: number;
    title: string;
    time: string;
    room: string;
    notes: string;
    employee_ids: number[];
}

interface TrainingFromServer {
    id: number;
    title: string;
    time: string | null;
    room: string | null;
    notes: string | null;
    employees: { id: number; name: string; preferred_name: string | null }[];
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

interface LocationKioskData {
    [locationId: string]: {
        employees: EmployeeOption[];
        managers: EmployeeOption[];
    };
}

interface Props {
    prestart: Prestart | null;
    duplicateFrom?: Prestart | null;
    locations: Location[];
    locationKioskData: LocationKioskData;
    trainings: TrainingFromServer[];
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

function EmployeeMultiSelect({
    employees,
    selectedIds,
    onChange,
}: {
    employees: EmployeeOption[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const filtered = employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

    const toggle = (id: number) => {
        onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    };

    return (
        <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpen(!open)}>
                <span className="text-sm">
                    {selectedIds.length > 0 ? `${selectedIds.length} employee${selectedIds.length > 1 ? 's' : ''} selected` : 'Select employees...'}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
            {open && (
                <div className="rounded-md border">
                    <div className="border-b px-3 py-2">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search employees..."
                            className="h-8"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                        {filtered.length === 0 && (
                            <p className="px-2 py-3 text-center text-sm text-muted-foreground">No employees found.</p>
                        )}
                        {filtered.map((emp) => (
                            <label
                                key={emp.id}
                                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                            >
                                <Checkbox
                                    checked={selectedIds.includes(emp.id)}
                                    onCheckedChange={() => toggle(emp.id)}
                                />
                                <span>{emp.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const TRAINING_OPTIONS = [
    'Workplace Impairment Training (WIT)',
    'Supporting Positive Mental Health in the Construction Industry',
    'Quantitative Fit Testing',
    'Course in Crystalline Silica Exposure Prevention',
    'Asbestos Awareness',
];

export default function DailyPrestartForm({ prestart, duplicateFrom, locations, locationKioskData, trainings: initialTrainings }: Props) {
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

    // --- Location-scoped employees & managers ---
    const kioskData = data.location_id ? locationKioskData[data.location_id] : null;
    const locationEmployees = kioskData?.employees ?? [];
    const locationManagers = kioskData?.managers ?? [];

    // --- Trainings state ---
    const [trainingsList, setTrainingsList] = useState<TrainingData[]>(
        initialTrainings.map((t) => ({
            id: t.id,
            title: t.title,
            time: t.time ?? '',
            room: t.room ?? '',
            notes: t.notes ?? '',
            employee_ids: t.employees.map((e) => e.id),
        })),
    );

    // Track which trainings have "Other" selected
    const [otherSelected, setOtherSelected] = useState<Record<number, boolean>>(
        () => {
            const map: Record<number, boolean> = {};
            initialTrainings.forEach((t, i) => {
                if (t.title && !TRAINING_OPTIONS.includes(t.title)) {
                    map[i] = true;
                }
            });
            return map;
        },
    );

    const addTraining = () => {
        setTrainingsList([...trainingsList, { title: '', time: '', room: '', notes: '', employee_ids: [] }]);
    };

    const updateTraining = (index: number, field: keyof TrainingData, value: unknown) => {
        setTrainingsList((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
    };

    const removeTraining = (index: number) => {
        setTrainingsList((prev) => prev.filter((_, i) => i !== index));
    };

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
        trainingsList.forEach((t, i) => {
            if (t.id) formData.append(`trainings[${i}][id]`, String(t.id));
            formData.append(`trainings[${i}][title]`, t.title);
            if (t.time) formData.append(`trainings[${i}][time]`, t.time);
            if (t.room) formData.append(`trainings[${i}][room]`, t.room);
            if (t.notes) formData.append(`trainings[${i}][notes]`, t.notes);
            t.employee_ids.forEach((eid, j) => {
                formData.append(`trainings[${i}][employee_ids][${j}]`, String(eid));
            });
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
    const managerOptions = locationManagers.map((m: EmployeeOption) => ({ value: String(m.id), label: m.name }));

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
                            options={managerOptions}
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

                    {/* Trainings */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold">Booked Training</h3>
                                <p className="text-sm text-muted-foreground">Scheduled training on this day.</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addTraining} disabled={!data.location_id}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Add Training
                            </Button>
                        </div>

                        {!data.location_id && trainingsList.length === 0 && (
                            <p className="text-sm text-muted-foreground italic">Select a project to add training.</p>
                        )}


                        {trainingsList.map((training, index) => (
                            <div key={index} className="space-y-3 rounded-lg border p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Training {index + 1}</span>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTraining(index)}>
                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="sm:col-span-2 space-y-2">
                                        <Label>Title *</Label>
                                        <Select
                                            value={otherSelected[index] ? 'OTHER' : training.title}
                                            onValueChange={(val) => {
                                                if (val === 'OTHER') {
                                                    setOtherSelected((prev) => ({ ...prev, [index]: true }));
                                                    updateTraining(index, 'title', '');
                                                } else {
                                                    setOtherSelected((prev) => ({ ...prev, [index]: false }));
                                                    updateTraining(index, 'title', val);
                                                }
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select training..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TRAINING_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                ))}
                                                <SelectItem value="OTHER">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {otherSelected[index] && (
                                            <Input
                                                value={training.title}
                                                onChange={(e) => updateTraining(index, 'title', e.target.value)}
                                                placeholder="Enter training name..."
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <Label>Time</Label>
                                        <TimePicker
                                            value={training.time}
                                            onChange={(val) => updateTraining(index, 'time', val)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Room / Location</Label>
                                        <Input
                                            value={training.room}
                                            onChange={(e) => updateTraining(index, 'room', e.target.value)}
                                            placeholder="e.g. Meeting Room B"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Label>Notes</Label>
                                        <Textarea
                                            value={training.notes}
                                            onChange={(e) => updateTraining(index, 'notes', e.target.value)}
                                            placeholder="Additional notes..."
                                            rows={2}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Label>Employees</Label>
                                        <EmployeeMultiSelect
                                            employees={locationEmployees}
                                            selectedIds={training.employee_ids}
                                            onChange={(ids) => updateTraining(index, 'employee_ids', ids)}
                                        />
                                        {training.employee_ids.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {training.employee_ids.map((id) => {
                                                    const emp = locationEmployees.find((e) => e.id === id);
                                                    return emp ? (
                                                        <Badge key={id} variant="secondary" className="gap-1">
                                                            {emp.name}
                                                            <button
                                                                type="button"
                                                                onClick={() => updateTraining(index, 'employee_ids', training.employee_ids.filter((x) => x !== id))}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </Badge>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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
