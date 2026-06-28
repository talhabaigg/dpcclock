import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dropzone } from '@/components/ui/dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type DeliverableDetail, type DeliverableType, type RequestPayload, type TypesConfig, TYPE_ORDER } from './shared';

interface Props {
    baseUrl: string;
    types: TypesConfig;
    entry?: DeliverableDetail | null;
    /** Where Cancel returns to. */
    cancelUrl: string;
}

export default function WhsDeliverableForm({ baseUrl, types, entry, cancelUrl }: Props) {
    const isEdit = !!entry;

    const [type, setType] = useState<DeliverableType>(entry?.type ?? 'plant');
    const [name, setName] = useState(entry?.name ?? '');
    const [details, setDetails] = useState<Record<string, string>>(entry?.details ?? {});
    const [checklist, setChecklist] = useState<Record<string, boolean>>(entry?.checklist ?? {});
    const [lastDate, setLastDate] = useState(entry?.last_date ?? '');
    const [nextDate, setNextDate] = useState(entry?.next_date ?? '');
    const [notify, setNotify] = useState(entry?.notify ?? true);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(entry?.photo_url ?? null);
    const [removePhoto, setRemovePhoto] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const config = types[type];

    const pickType = (next: DeliverableType) => {
        if (next === type) return;
        setType(next);
        setDetails({});
        setChecklist({});
        setErrors({});
        if (!types[next].physical) {
            setPhoto(null);
            setPhotoPreview(null);
            setRemovePhoto(true);
        }
    };

    const acceptPhoto = (files: File[]) => {
        const file = files[0];
        if (!file) return;
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
        setRemovePhoto(false);
    };

    const clearPhoto = () => {
        setPhoto(null);
        setPhotoPreview(null);
        setRemovePhoto(true);
    };

    const submit = () => {
        const payload: RequestPayload = {
            type,
            name,
            details,
            last_date: lastDate || '',
            next_date: nextDate || '',
            notify: notify ? 1 : 0,
        };
        if (config.checklist) {
            payload.checklist = config.checklist.reduce<Record<string, number>>((acc, item) => {
                acc[item.key] = checklist[item.key] ? 1 : 0;
                return acc;
            }, {});
        }
        if (photo) payload.photo = photo;
        if (isEdit) {
            payload._method = 'put';
            if (removePhoto && !photo) payload.remove_photo = 1;
        }

        const url = isEdit ? `${baseUrl}/${entry!.id}` : baseUrl;

        router.post(url, payload, {
            forceFormData: true,
            onStart: () => setProcessing(true),
            onError: (e) => setErrors(e as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    };

    const orderedTypes = useMemo(() => TYPE_ORDER.filter((t) => types[t]), [types]);

    return (
        <Card>
            <CardContent className="space-y-6 px-4 py-6 sm:px-6">
                {/* type */}
                <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Deliverable type</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {orderedTypes.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => pickType(t)}
                                disabled={isEdit}
                                className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    type === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'
                                }`}
                            >
                                {types[t].label}
                            </button>
                        ))}
                    </div>
                    {isEdit && <p className="text-muted-foreground text-[11px]">Type can't be changed after creation.</p>}
                </div>

                {/* name */}
                <div className="space-y-1.5">
                    <Label htmlFor="whs-name" className="text-muted-foreground text-xs">
                        Name
                    </Label>
                    <Input id="whs-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Excavator 12T" />
                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                {/* photo */}
                {config.physical && (
                    <div className="space-y-1.5">
                        <Label className="text-muted-foreground text-xs">
                            Photo <span className="text-muted-foreground/60">· helps identify the item</span>
                        </Label>
                        {photoPreview ? (
                            <div className="relative h-44 w-full overflow-hidden rounded-lg border">
                                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={clearPhoto}
                                    className="bg-background/80 text-foreground absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md backdrop-blur"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <Dropzone
                                accept="image/*"
                                maxSize={50 * 1024 * 1024}
                                onDrop={acceptPhoto}
                                onError={(message) => setErrors((e) => ({ ...e, photo: message }))}
                                label="Add a photo"
                                hint="Drag & drop or tap to upload · PNG or JPG up to 50MB"
                            />
                        )}
                        {errors.photo && <p className="text-xs text-red-500">{errors.photo}</p>}
                    </div>
                )}

                {/* type-specific fields */}
                <div className="space-y-4 border-t pt-5">
                    <div className="text-muted-foreground text-xs font-semibold">{config.label} details</div>
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        {config.fields.map((field) => (
                            <div key={field.key} className={field.full ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}>
                                <Label className="text-muted-foreground text-xs">
                                    {field.label}
                                    {field.optional && <span className="text-muted-foreground/60"> · optional</span>}
                                </Label>
                                {field.type === 'select' ? (
                                    <Select value={details[field.key] ?? ''} onValueChange={(v) => setDetails((d) => ({ ...d, [field.key]: v }))}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.options?.map((opt) => (
                                                <SelectItem key={opt} value={opt}>
                                                    {opt}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        value={details[field.key] ?? ''}
                                        onChange={(e) => setDetails((d) => ({ ...d, [field.key]: e.target.value }))}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {config.checklist && (
                        <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">{config.checklist_label ?? 'Inspection checklist'}</Label>
                            <div className="space-y-2">
                                {config.checklist.map((item) => (
                                    <label key={item.key} className="flex cursor-pointer items-center gap-2.5 text-sm">
                                        <Checkbox
                                            checked={!!checklist[item.key]}
                                            onCheckedChange={(c) => setChecklist((s) => ({ ...s, [item.key]: !!c }))}
                                        />
                                        {item.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="whs-last" className="text-muted-foreground text-xs">
                                {config.last_label}
                            </Label>
                            <DatePicker id="whs-last" value={lastDate} onChange={setLastDate} clearable placeholder="Select date" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="whs-next" className="text-muted-foreground text-xs">
                                {config.next_label}
                                {config.next_optional && <span className="text-muted-foreground/60"> · optional</span>}
                            </Label>
                            <DatePicker id="whs-next" value={nextDate} onChange={setNextDate} clearable placeholder="Select date" />
                        </div>
                    </div>
                </div>

                {/* notify */}
                <div className="bg-muted/40 flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
                    <div>
                        <div className="text-sm font-medium">Send expiry notification emails</div>
                        <div className="text-muted-foreground text-xs">Alert 7 days before due.</div>
                    </div>
                    <Switch checked={notify} onCheckedChange={setNotify} />
                </div>

                {/* actions */}
                <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.visit(cancelUrl)} disabled={processing}>
                        Cancel
                    </Button>
                    <Button className="w-full sm:w-auto" onClick={submit} disabled={processing || !name.trim()}>
                        {isEdit ? 'Save changes' : 'Add deliverable'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
