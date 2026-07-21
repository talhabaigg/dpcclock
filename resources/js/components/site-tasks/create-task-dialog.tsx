import { DatePickerDemo } from '@/components/date-picker';
import { CategoryCode, describeError, EmployeeMultiPicker } from '@/components/site-tasks/task-sections';
import { type CategoryOption, type EmployeeOption, type SiteTaskDto } from '@/components/site-tasks/types';
import { Button } from '@/components/ui/button';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dropzone } from '@/components/ui/dropzone';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export type PinPoint = { drawing_id: number; page_number: number; x: number; y: number };

/**
 * Single-screen quick-create dialog shared by the plan viewer (pin drop) and
 * the kanban board: category → name (preset or custom) → assignees → due
 * date → photos. Photos are posted as a comment on the new task, matching
 * how photos travel everywhere else in site tasks.
 */
export function CreateSiteTaskDialog({
    projectId,
    open,
    onOpenChange,
    categories,
    employees,
    pin,
    onCreated,
}: {
    projectId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: CategoryOption[];
    employees: EmployeeOption[];
    /** Present when created from a dropped pin on a plan. */
    pin?: PinPoint | null;
    onCreated: (taskId: number) => void;
}) {
    const [categoryId, setCategoryId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [employeeIds, setEmployeeIds] = useState<number[]>([]);
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [photos, setPhotos] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);

    const selectedCategory = categories.find((c) => String(c.id) === categoryId);

    const reset = () => {
        setCategoryId('');
        setTitle('');
        setEmployeeIds([]);
        setDueDate(undefined);
        setPhotos([]);
    };

    const submit = async () => {
        if (!categoryId) {
            toast.error('Pick a category.');
            return;
        }
        if (!title.trim()) {
            toast.error('Give the task a name.');
            return;
        }
        setSaving(true);
        try {
            const res = await api.post<{ task: SiteTaskDto }>(`/projects/${projectId}/site-tasks`, {
                category_id: Number(categoryId),
                title: title.trim(),
                due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
                employee_ids: employeeIds,
                ...(pin ?? {}),
            });

            if (photos.length > 0) {
                // Photos ride a comment — same as attachments added later in
                // the task dialog.
                const formData = new FormData();
                formData.append('commentable_type', 'site_task');
                formData.append('commentable_id', String(res.task.id));
                photos.forEach((file) => formData.append('attachments[]', file));
                try {
                    await api.post('/comments', formData);
                } catch (e) {
                    toast.warning(`Task created, but the photo upload failed (${describeError(e)}) — add it from the task comments.`);
                }
            }

            toast.success('Task created');
            reset();
            onOpenChange(false);
            onCreated(res.task.id);
        } catch (e) {
            toast.error(describeError(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-sm">{pin ? 'New Pin Task' : 'Create Task'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    {/* Category first — it decides which name presets are offered below. */}
                    <Field>
                        <FieldLabel className="text-xs">Category</FieldLabel>
                        <div className="flex flex-wrap gap-1.5">
                            {categories.map((c) => {
                                const selected = String(c.id) === categoryId;
                                return (
                                    <Button
                                        key={c.id}
                                        type="button"
                                        variant={selected ? 'secondary' : 'outline'}
                                        size="sm"
                                        aria-pressed={selected}
                                        className={cn('coarse:h-9 h-8 gap-1.5 text-xs', selected && 'ring-primary ring-2')}
                                        onClick={() => setCategoryId(String(c.id))}
                                    >
                                        <CategoryCode category={c} />
                                        {c.name}
                                    </Button>
                                );
                            })}
                            {categories.length === 0 && <p className="text-muted-foreground text-xs">No categories configured.</p>}
                        </div>
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Task name</FieldLabel>
                        <TitlePresetInput
                            value={title}
                            onChange={setTitle}
                            presets={(selectedCategory?.presets ?? []).map((p) => p.title)}
                            onSubmit={() => void submit()}
                        />
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Assign to (optional)</FieldLabel>
                        <EmployeeMultiPicker employees={employees} selected={employeeIds} onChange={setEmployeeIds} />
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Due date (optional)</FieldLabel>
                        <DatePickerDemo value={dueDate} onChange={setDueDate} />
                    </Field>
                    <Field>
                        <FieldLabel className="text-xs">Photos (optional)</FieldLabel>
                        <Dropzone
                            accept="image/*"
                            multiple
                            maxSize={20 * 1024 * 1024}
                            onDrop={(files) => setPhotos((prev) => [...prev, ...files])}
                            onError={(message) => toast.error(message)}
                            label="Drag & drop photos, or click to upload"
                            hint="Added as a comment on the task"
                            className="py-5"
                        />
                        {photos.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {photos.map((file, i) => (
                                    <div key={`${file.name}-${i}`} className="relative h-16 w-16 overflow-hidden rounded border">
                                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="absolute top-0.5 right-0.5 h-5 w-5 p-0"
                                            aria-label={`Remove ${file.name}`}
                                            onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={submit} disabled={saving}>
                        {saving ? <Spinner className="h-3.5 w-3.5" /> : 'Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Name field for quick creation: free-text input that also offers the
 * selected category's title presets in a dropdown. With no presets it is a
 * plain input.
 */
function TitlePresetInput({
    value,
    onChange,
    presets,
    onSubmit,
}: {
    value: string;
    onChange: (value: string) => void;
    presets: string[];
    onSubmit: () => void;
}) {
    const [open, setOpen] = useState(false);

    if (presets.length === 0) {
        return (
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="What needs doing?"
                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            />
        );
    }

    return (
        <Combobox<string> items={presets} open={open} onOpenChange={setOpen} inputValue={value} onInputValueChange={onChange}>
            <ComboboxInput
                placeholder="Pick a preset or type your own"
                className="w-full"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !open) onSubmit();
                }}
            />
            <ComboboxContent>
                <ComboboxEmpty>No matching presets — your text is used as-is.</ComboboxEmpty>
                <ComboboxList>
                    {(preset: string) => (
                        <ComboboxItem key={preset} value={preset}>
                            <span className="truncate">{preset}</span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
