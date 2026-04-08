import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SearchSelect } from '@/components/search-select';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Minus, Plus, X } from 'lucide-react';
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

interface Talk {
    id: string;
    location_id: number;
    meeting_date: string;
    called_by: number | null;
    meeting_subject: string;
    key_topics: { description: string }[] | null;
    action_points: { description: string }[] | null;
    injuries: { description: string }[] | null;
    near_misses: { description: string }[] | null;
    floor_comments: { description: string }[] | null;
    media: MediaItem[];
}

interface Props {
    talk: Talk | null;
    locations: Location[];
    users: UserOption[];
    subjectOptions: Record<string, string>;
    generalItems: string[];
}

type ListField = 'key_topics' | 'action_points' | 'injuries' | 'near_misses' | 'floor_comments';
type FileField = 'topic_files' | 'action_point_files' | 'injury_files' | 'near_miss_files' | 'floor_comment_files';

export default function ToolboxTalkForm({ talk, locations, users, subjectOptions, generalItems }: Props) {
    const isEdit = !!talk;
    const { auth } = usePage<{ auth: { user: { id: number } } }>().props as { auth: { user: { id: number } } };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Toolbox Talks', href: '/toolbox-talks' },
        { title: isEdit ? 'Edit' : 'New Toolbox Talk', href: '#' },
    ];

    const { data, setData, processing, errors } = useForm({
        location_id: talk?.location_id ? String(talk.location_id) : '',
        meeting_date: talk?.meeting_date ?? new Date().toISOString().slice(0, 10),
        called_by: talk?.called_by ? String(talk.called_by) : String(auth.user.id),
        meeting_subject: talk?.meeting_subject ?? '',
        key_topics: talk?.key_topics ?? [{ description: '' }, { description: '' }] as { description: string }[],
        action_points: talk?.action_points ?? [{ description: '' }, { description: '' }] as { description: string }[],
        injuries: talk?.injuries ?? [{ description: '' }, { description: '' }] as { description: string }[],
        near_misses: talk?.near_misses ?? [{ description: '' }, { description: '' }] as { description: string }[],
        floor_comments: talk?.floor_comments ?? [{ description: '' }, { description: '' }] as { description: string }[],
        topic_files: [] as File[],
        action_point_files: [] as File[],
        injury_files: [] as File[],
        near_miss_files: [] as File[],
        floor_comment_files: [] as File[],
        removed_media_ids: [] as number[],
    });

    const existingMedia = talk?.media ?? [];
    const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);

    const getMedia = (collection: string) => existingMedia.filter((m) => m.collection_name === collection && !removedMediaIds.includes(m.id));

    const removeMedia = (id: number) => {
        setRemovedMediaIds((prev) => [...prev, id]);
        setData('removed_media_ids', [...removedMediaIds, id]);
    };

    const addItem = (field: ListField) => setData(field, [...data[field], { description: '' }]);
    const removeLastItem = (field: ListField) => {
        if (data[field].length > 1) setData(field, data[field].slice(0, -1));
    };
    const updateItem = (field: ListField, i: number, value: string) => {
        const updated = [...data[field]];
        updated[i] = { description: value };
        setData(field, updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('location_id', data.location_id);
        formData.append('meeting_date', data.meeting_date);
        if (data.called_by) formData.append('called_by', data.called_by);
        formData.append('meeting_subject', data.meeting_subject);

        (['key_topics', 'action_points', 'injuries', 'near_misses', 'floor_comments'] as ListField[]).forEach((field) => {
            data[field].filter((item) => item.description.trim()).forEach((item, i) => {
                formData.append(`${field}[${i}][description]`, item.description);
            });
        });

        (['topic_files', 'action_point_files', 'injury_files', 'near_miss_files', 'floor_comment_files'] as FileField[]).forEach((fileKey) => {
            data[fileKey].forEach((f, i) => formData.append(`${fileKey}[${i}]`, f));
        });

        if (isEdit) {
            removedMediaIds.forEach((id, i) => formData.append(`removed_media_ids[${i}]`, String(id)));
            formData.append('_method', 'PUT');
            router.post(`/toolbox-talks/${talk.id}`, formData, { forceFormData: true });
        } else {
            router.post('/toolbox-talks', formData, { forceFormData: true });
        }
    };

    const locationOptions = locations.map((l) => ({ value: String(l.id), label: l.name }));
    const userOptions = users.map((u) => ({ value: String(u.id), label: u.name }));

    const renderListSection = (
        title: string,
        field: ListField,
        itemLabel: string,
        placeholder: string,
        fileLabel: string,
        fileCollection: string,
        fileKey: FileField,
    ) => {
        const media = getMedia(fileCollection);
        return (
            <div className="space-y-3">
                <h3 className="text-base font-semibold">{title}</h3>
                {data[field].map((item, i) => (
                    <Input
                        key={i}
                        value={item.description}
                        onChange={(e) => updateItem(field, i, e.target.value)}
                        placeholder={`${i + 1} ${placeholder}`}
                    />
                ))}
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addItem(field)}>
                        <Plus className="mr-1 h-3 w-3" />
                        {itemLabel}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeLastItem(field)} disabled={data[field].length <= 1}>
                        <Minus className="mr-1 h-3 w-3" />
                        {itemLabel}
                    </Button>
                </div>

                {media.length > 0 && (
                    <div className="space-y-1">
                        {media.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 rounded border px-3 py-1 text-sm">
                                <a href={m.original_url} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">{m.file_name}</a>
                                <button type="button" onClick={() => removeMedia(m.id)}><X className="h-4 w-4 text-destructive" /></button>
                            </div>
                        ))}
                    </div>
                )}
                <Dropzone onDrop={(files) => setData(fileKey, [...data[fileKey], ...files])} maxFiles={10} multiple />
                {data[fileKey].length > 0 && (
                    <div className="space-y-1">
                        {data[fileKey].map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span className="flex-1">{f.name}</span>
                                <button type="button" onClick={() => setData(fileKey, data[fileKey].filter((_, idx) => idx !== i))}>
                                    <X className="h-4 w-4 text-destructive" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? 'Edit Toolbox Talk' : 'New Toolbox Talk'} />
            <div className="mx-auto min-w-96 max-w-96 space-y-6 p-4 sm:min-w-2xl sm:max-w-2xl">
                <h1 className="text-2xl font-bold">Toolbox talk summary</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label>Meeting day *</Label>
                        <Input type="date" value={data.meeting_date} onChange={(e) => setData('meeting_date', e.target.value)} />
                        {errors.meeting_date && <p className="mt-1 text-sm text-destructive">{errors.meeting_date}</p>}
                    </div>

                    <div>
                        <Label>Project *</Label>
                        <SearchSelect options={locationOptions} selectedOption={data.location_id} onValueChange={(val) => setData('location_id', val)} optionName="project" />
                        {errors.location_id && <p className="mt-1 text-sm text-destructive">{errors.location_id}</p>}
                    </div>

                    <div>
                        <Label>Meeting called by</Label>
                        <SearchSelect options={userOptions} selectedOption={data.called_by} onValueChange={(val) => setData('called_by', val)} optionName="user" />
                    </div>

                    <div>
                        <Label>Meeting subject *</Label>
                        <Select value={data.meeting_subject || 'none'} onValueChange={(val) => setData('meeting_subject', val === 'none' ? '' : val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Please select a meeting subject" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Please select a meeting subject</SelectItem>
                                {Object.entries(subjectOptions).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.meeting_subject && <p className="mt-1 text-sm text-destructive">{errors.meeting_subject}</p>}
                    </div>

                    <Separator />

                    {/* General Items (read-only, styled as cards) */}
                    <div>
                        <h3 className="text-base font-semibold">General items to be discussed</h3>
                        <div className="mt-2 space-y-2">
                            {generalItems.map((item, i) => (
                                <div key={i} className="rounded-lg bg-muted/50 px-4 py-3 text-sm leading-relaxed">{item}</div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {renderListSection('Key topics arising on site', 'key_topics', 'Topic', 'Describe the topic', 'Upload topic files here', 'topic_files', 'topic_files')}

                    <Separator />

                    {renderListSection('Action points from last meeting', 'action_points', 'Action point', 'Describe the action point', 'Upload action point files here', 'action_point_files', 'action_point_files')}

                    <Separator />

                    {renderListSection('Injuries from previous week', 'injuries', 'Injury', 'Describe the injury', 'Upload injury files here', 'injury_files', 'injury_files')}

                    <Separator />

                    {renderListSection('Near misses from previous week', 'near_misses', 'Near miss', 'Describe the near miss', 'Upload near miss files here', 'near_miss_files', 'near_miss_files')}

                    <Separator />

                    {renderListSection('Comments from the floor', 'floor_comments', 'Comment', 'Describe the comment', 'Upload comment files here', 'floor_comment_files', 'floor_comment_files')}

                    <Separator />

                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={processing}>
                            {isEdit ? 'Update Toolbox Talk' : 'Create Toolbox Talk'}
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <Link href="/toolbox-talks">Cancel</Link>
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
