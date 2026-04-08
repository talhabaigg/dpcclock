import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { SearchSelect } from '@/components/search-select';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Plus, Trash2, X } from 'lucide-react';
import Dropzone from 'shadcn-dropzone';
import { useState } from 'react';

interface Location {
    id: number;
    name: string;
}

interface UserOption {
    id: number;
    name: string;
}

interface MediaItem {
    id: number;
    file_name: string;
    original_url: string;
    collection_name: string;
}

interface Prestart {
    id: string;
    location_id: number;
    work_date: string;
    foreman_id: number | null;
    weather: string | null;
    weather_impact: string | null;
    activities: { description: string }[] | null;
    safety_concerns: { description: string }[] | null;
    media: MediaItem[];
}

interface Props {
    prestart: Prestart | null;
    duplicateFrom?: Prestart | null;
    locations: Location[];
    users: UserOption[];
}

export default function DailyPrestartForm({ prestart, duplicateFrom, locations, users }: Props) {
    const isEdit = !!prestart;
    const source = prestart ?? duplicateFrom;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Daily Prestarts', href: '/daily-prestarts' },
        { title: isEdit ? 'Edit Prestart' : duplicateFrom ? 'Duplicate Prestart' : 'New Prestart', href: '#' },
    ];

    const { data, setData, processing, errors } = useForm({
        location_id: source?.location_id ? String(source.location_id) : '',
        work_date: source?.work_date ?? new Date().toISOString().slice(0, 10),
        foreman_id: source?.foreman_id ? String(source.foreman_id) : '',
        weather: source?.weather ?? '',
        weather_impact: source?.weather_impact ?? '',
        activities: source?.activities ?? ([] as { description: string }[]),
        safety_concerns: source?.safety_concerns ?? ([] as { description: string }[]),
        activity_files: [] as File[],
        safety_concern_files: [] as File[],
        builders_prestart_file: [] as File[],
        removed_media_ids: [] as number[],
    });

    // Existing media grouped by collection
    const existingMedia = prestart?.media ?? [];
    const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);

    const activityMedia = existingMedia.filter((m) => m.collection_name === 'activity_files' && !removedMediaIds.includes(m.id));
    const safetyConcernMedia = existingMedia.filter((m) => m.collection_name === 'safety_concern_files' && !removedMediaIds.includes(m.id));
    const buildersPrestartMedia = existingMedia.filter((m) => m.collection_name === 'builders_prestart_file' && !removedMediaIds.includes(m.id));

    const removeMedia = (id: number) => {
        setRemovedMediaIds((prev) => [...prev, id]);
        setData('removed_media_ids', [...removedMediaIds, id]);
    };

    // Dynamic list helpers
    const addActivity = () => setData('activities', [...data.activities, { description: '' }]);
    const removeActivity = (i: number) => setData('activities', data.activities.filter((_, idx) => idx !== i));
    const updateActivity = (i: number, value: string) => {
        const updated = [...data.activities];
        updated[i] = { description: value };
        setData('activities', updated);
    };

    const addSafetyConcern = () => setData('safety_concerns', [...data.safety_concerns, { description: '' }]);
    const removeSafetyConcern = (i: number) => setData('safety_concerns', data.safety_concerns.filter((_, idx) => idx !== i));
    const updateSafetyConcern = (i: number, value: string) => {
        const updated = [...data.safety_concerns];
        updated[i] = { description: value };
        setData('safety_concerns', updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('location_id', data.location_id);
        formData.append('work_date', data.work_date);
        if (data.foreman_id) formData.append('foreman_id', data.foreman_id);
        if (data.weather) formData.append('weather', data.weather);
        if (data.weather_impact) formData.append('weather_impact', data.weather_impact);

        data.activities.forEach((a, i) => {
            formData.append(`activities[${i}][description]`, a.description);
        });
        data.safety_concerns.forEach((s, i) => {
            formData.append(`safety_concerns[${i}][description]`, s.description);
        });

        data.activity_files.forEach((f, i) => formData.append(`activity_files[${i}]`, f));
        data.safety_concern_files.forEach((f, i) => formData.append(`safety_concern_files[${i}]`, f));
        data.builders_prestart_file.forEach((f, i) => formData.append(`builders_prestart_file[${i}]`, f));

        if (isEdit) {
            removedMediaIds.forEach((id, i) => formData.append(`removed_media_ids[${i}]`, String(id)));
            formData.append('_method', 'PUT');
            router.post(`/daily-prestarts/${prestart.id}`, formData, { forceFormData: true });
        } else {
            router.post('/daily-prestarts', formData, { forceFormData: true });
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
                        <Label>Weather</Label>
                        <Input value={data.weather} onChange={(e) => setData('weather', e.target.value)} placeholder="e.g. Sunny, 28C" />
                    </div>

                    {/* Weather Impact */}
                    <div>
                        <Label>Weather Impact</Label>
                        <Input value={data.weather_impact} onChange={(e) => setData('weather_impact', e.target.value)} placeholder="Impact on work..." />
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
                        {data.activities.map((activity, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Textarea
                                    value={activity.description}
                                    onChange={(e) => updateActivity(i, e.target.value)}
                                    placeholder="Describe activity..."
                                    rows={2}
                                    className="flex-1"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeActivity(i)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addActivity}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Activity
                        </Button>

                        <div>
                            <Label>Activity Files</Label>
                            {activityMedia.length > 0 && (
                                <div className="mb-2 space-y-1">
                                    {activityMedia.map((m) => (
                                        <div key={m.id} className="flex items-center gap-2 rounded border px-3 py-1 text-sm">
                                            <a href={m.original_url} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">
                                                {m.file_name}
                                            </a>
                                            <button type="button" onClick={() => removeMedia(m.id)}>
                                                <X className="h-4 w-4 text-destructive" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Dropzone
                                onDrop={(files) => setData('activity_files', [...data.activity_files, ...files])}
                                maxFiles={10}
                                multiple
                            />
                            {data.activity_files.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {data.activity_files.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <span className="flex-1">{f.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setData('activity_files', data.activity_files.filter((_, idx) => idx !== i))}
                                            >
                                                <X className="h-4 w-4 text-destructive" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Safety Concerns */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-base font-semibold">Safety Concerns / Incidents</h3>
                            <p className="text-sm text-muted-foreground">Items to be raised from the previous day.</p>
                        </div>
                        {data.safety_concerns.map((concern, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <Textarea
                                    value={concern.description}
                                    onChange={(e) => updateSafetyConcern(i, e.target.value)}
                                    placeholder="Describe safety concern..."
                                    rows={2}
                                    className="flex-1"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeSafetyConcern(i)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addSafetyConcern}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Safety Concern
                        </Button>

                        <div>
                            <Label>Safety Concern Files</Label>
                            {safetyConcernMedia.length > 0 && (
                                <div className="mb-2 space-y-1">
                                    {safetyConcernMedia.map((m) => (
                                        <div key={m.id} className="flex items-center gap-2 rounded border px-3 py-1 text-sm">
                                            <a href={m.original_url} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">
                                                {m.file_name}
                                            </a>
                                            <button type="button" onClick={() => removeMedia(m.id)}>
                                                <X className="h-4 w-4 text-destructive" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Dropzone
                                onDrop={(files) => setData('safety_concern_files', [...data.safety_concern_files, ...files])}
                                maxFiles={10}
                                multiple
                            />
                            {data.safety_concern_files.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {data.safety_concern_files.map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <span className="flex-1">{f.name}</span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setData('safety_concern_files', data.safety_concern_files.filter((_, idx) => idx !== i))
                                                }
                                            >
                                                <X className="h-4 w-4 text-destructive" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Builders Daily Prestart */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-base font-semibold">Builders Daily Pre-Start</h3>
                            <p className="text-sm text-muted-foreground">Upload your builders daily prestart file here.</p>
                        </div>
                        {buildersPrestartMedia.length > 0 && (
                            <div className="space-y-1">
                                {buildersPrestartMedia.map((m) => (
                                    <div key={m.id} className="flex items-center gap-2 rounded border px-3 py-1 text-sm">
                                        <a href={m.original_url} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">
                                            {m.file_name}
                                        </a>
                                        <button type="button" onClick={() => removeMedia(m.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Dropzone
                            onDrop={(files) => setData('builders_prestart_file', [...data.builders_prestart_file, ...files])}
                            maxFiles={5}
                            multiple
                        />
                        {data.builders_prestart_file.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {data.builders_prestart_file.map((f, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <span className="flex-1">{f.name}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setData('builders_prestart_file', data.builders_prestart_file.filter((_, idx) => idx !== i))
                                            }
                                        >
                                            <X className="h-4 w-4 text-destructive" />
                                        </button>
                                    </div>
                                ))}
                            </div>
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
