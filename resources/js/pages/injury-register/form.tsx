import MultiCheckboxSection from '@/components/injury-register/MultiCheckboxSection';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryEmployee, InjuryFormOptions, InjuryLocation } from '@/types/injury';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { RotateCcw, Trash2 } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { useCallback, useEffect, useRef } from 'react';

interface Props {
    injury: Injury | null;
    locations: InjuryLocation[];
    employees: InjuryEmployee[];
    options: InjuryFormOptions;
}

export default function InjuryForm({ injury, locations, employees, options }: Props) {
    const isEdit = !!injury;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Injury Register', href: '/injury-register' },
        { title: isEdit ? `Edit ${injury.id_formal}` : 'Report Incident / Injury', href: '#' },
    ];

    const { data, setData, post, put, processing, errors } = useForm({
        incident: injury?.incident ?? '',
        incident_other: injury?.incident_other ?? '',
        employee_id: injury?.employee_id ? String(injury.employee_id) : '',
        employee_address: injury?.employee_address ?? '',
        location_id: injury?.location_id ? String(injury.location_id) : '',
        location_of_incident: injury?.location_of_incident ?? '',
        occurred_at: injury?.occurred_at ? injury.occurred_at.slice(0, 16) : '',
        reported_by: injury?.reported_by ?? '',
        reported_at: injury?.reported_at ? injury.reported_at.slice(0, 16) : '',
        reported_to: injury?.reported_to ?? '',
        description: injury?.description ?? '',
        emergency_services: injury?.emergency_services ?? false,
        treatment: injury?.treatment ?? false,
        treatment_at: injury?.treatment_at ? injury.treatment_at.slice(0, 16) : '',
        treatment_provider: injury?.treatment_provider ?? '',
        treatment_external: injury?.treatment_external ?? '',
        treatment_external_location: injury?.treatment_external_location ?? '',
        no_treatment_reason: injury?.no_treatment_reason ?? '',
        follow_up: injury?.follow_up ?? false,
        follow_up_notes: injury?.follow_up_notes ?? '',
        witnesses: injury?.witnesses ?? false,
        witness_details: injury?.witness_details ?? '',
        natures: injury?.natures ?? ([] as string[]),
        natures_comments: injury?.natures_comments ?? '',
        mechanisms: injury?.mechanisms ?? ([] as string[]),
        mechanisms_comments: injury?.mechanisms_comments ?? '',
        agencies: injury?.agencies ?? ([] as string[]),
        agencies_comments: injury?.agencies_comments ?? '',
        contributions: injury?.contributions ?? ([] as string[]),
        contributions_comments: injury?.contributions_comments ?? '',
        corrective_actions: injury?.corrective_actions ?? ([] as string[]),
        corrective_actions_comments: injury?.corrective_actions_comments ?? '',
        worker_signature: injury?.worker_signature ?? '',
        representative_signature: injury?.representative_signature ?? '',
        representative_id: injury?.representative_id ? String(injury.representative_id) : '',
        files: [] as File[],
    });

    // Signature pads
    const workerCanvasRef = useRef<HTMLCanvasElement>(null);
    const workerPadRef = useRef<SignaturePad | null>(null);
    const repCanvasRef = useRef<HTMLCanvasElement>(null);
    const repPadRef = useRef<SignaturePad | null>(null);

    const initPad = (canvasRef: React.RefObject<HTMLCanvasElement | null>, padRef: React.MutableRefObject<SignaturePad | null>, existing?: string) => {
        if (!canvasRef.current || padRef.current) return;
        const canvas = canvasRef.current;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        padRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        if (existing) {
            padRef.current.fromDataURL(existing);
        }
    };

    useEffect(() => {
        initPad(workerCanvasRef, workerPadRef, injury?.worker_signature ?? undefined);
        initPad(repCanvasRef, repPadRef, injury?.representative_signature ?? undefined);
    }, []);

    const clearPad = useCallback((padRef: React.MutableRefObject<SignaturePad | null>) => {
        padRef.current?.clear();
    }, []);

    const undoPad = useCallback((padRef: React.MutableRefObject<SignaturePad | null>) => {
        const pad = padRef.current;
        if (!pad) return;
        const d = pad.toData();
        if (d.length > 0) {
            d.pop();
            pad.fromData(d);
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const formData = {
            ...data,
            worker_signature: workerPadRef.current && !workerPadRef.current.isEmpty() ? workerPadRef.current.toDataURL('image/png') : '',
            representative_signature: repPadRef.current && !repPadRef.current.isEmpty() ? repPadRef.current.toDataURL('image/png') : '',
        };

        if (isEdit) {
            router.post(`/injury-register/${injury.id}`, { ...formData, _method: 'PUT' }, { forceFormData: true });
        } else {
            router.post('/injury-register', formData, { forceFormData: true });
        }
    };

    const fieldError = (field: string) => (errors as Record<string, string>)[field];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? `Edit ${injury.id_formal}` : 'Report Incident / Injury'} />

            <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-8 p-4">
                {/* Type of Incident */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Type of Incident</h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Incident Type *</Label>
                            <Select value={data.incident} onValueChange={(v) => setData('incident', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select incident type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(options.incidents).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError('incident') && <p className="text-sm text-red-500">{fieldError('incident')}</p>}
                        </div>
                        {data.incident === 'other' && (
                            <div className="space-y-2">
                                <Label>Other (specify)</Label>
                                <Input value={data.incident_other} onChange={(e) => setData('incident_other', e.target.value)} />
                            </div>
                        )}
                    </div>
                </section>

                <Separator />

                {/* Worker & Location */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Worker & Location</h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Worker *</Label>
                            <Select value={data.employee_id} onValueChange={(v) => setData('employee_id', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select worker" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={String(emp.id)}>
                                            {emp.preferred_name ?? emp.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError('employee_id') && <p className="text-sm text-red-500">{fieldError('employee_id')}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Worker Address</Label>
                            <Input value={data.employee_address} onChange={(e) => setData('employee_address', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Project / Location *</Label>
                            <Select value={data.location_id} onValueChange={(v) => setData('location_id', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((loc) => (
                                        <SelectItem key={loc.id} value={String(loc.id)}>
                                            {loc.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError('location_id') && <p className="text-sm text-red-500">{fieldError('location_id')}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Location of Incident</Label>
                            <Input value={data.location_of_incident} onChange={(e) => setData('location_of_incident', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Date & Time of Occurrence *</Label>
                            <Input type="datetime-local" value={data.occurred_at} onChange={(e) => setData('occurred_at', e.target.value)} />
                            {fieldError('occurred_at') && <p className="text-sm text-red-500">{fieldError('occurred_at')}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Reported By</Label>
                            <Input value={data.reported_by} onChange={(e) => setData('reported_by', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Date & Time Reported</Label>
                            <Input type="datetime-local" value={data.reported_at} onChange={(e) => setData('reported_at', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Reported To</Label>
                            <Input value={data.reported_to} onChange={(e) => setData('reported_to', e.target.value)} />
                        </div>
                    </div>
                </section>

                <Separator />

                {/* Nature of Injury */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Nature of Injury / Illness</h2>
                    <MultiCheckboxSection
                        title=""
                        options={options.natures}
                        selected={data.natures}
                        onChange={(v) => setData('natures', v)}
                        comments={data.natures_comments}
                        onCommentsChange={(v) => setData('natures_comments', v)}
                    />
                </section>

                <Separator />

                {/* Mechanism of Injury */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Mechanism of Injury</h2>
                    <MultiCheckboxSection
                        title=""
                        options={options.mechanisms}
                        selected={data.mechanisms}
                        onChange={(v) => setData('mechanisms', v)}
                        comments={data.mechanisms_comments}
                        onCommentsChange={(v) => setData('mechanisms_comments', v)}
                    />
                </section>

                <Separator />

                {/* Agency of Incident */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Agency of Incident</h2>
                    <MultiCheckboxSection
                        title=""
                        options={options.agencies}
                        selected={data.agencies}
                        onChange={(v) => setData('agencies', v)}
                        comments={data.agencies_comments}
                        onCommentsChange={(v) => setData('agencies_comments', v)}
                    />
                </section>

                <Separator />

                {/* Contributing Factors */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Contributing Factors</h2>
                    <MultiCheckboxSection
                        title=""
                        options={options.contributions}
                        selected={data.contributions}
                        onChange={(v) => setData('contributions', v)}
                        comments={data.contributions_comments}
                        onCommentsChange={(v) => setData('contributions_comments', v)}
                    />
                </section>

                <Separator />

                {/* Corrective Actions */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Corrective Actions</h2>
                    <MultiCheckboxSection
                        title=""
                        options={options.correctiveActions}
                        selected={data.corrective_actions}
                        onChange={(v) => setData('corrective_actions', v)}
                        comments={data.corrective_actions_comments}
                        onCommentsChange={(v) => setData('corrective_actions_comments', v)}
                    />
                </section>

                <Separator />

                {/* File Uploads */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">File Uploads</h2>
                    <Input
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        onChange={(e) => setData('files', Array.from(e.target.files ?? []))}
                    />
                    {injury?.media && injury.media.length > 0 && (
                        <div className="space-y-1">
                            <Label className="text-muted-foreground text-sm">Existing files:</Label>
                            <ul className="list-inside list-disc text-sm">
                                {injury.media
                                    .filter((m) => m.collection_name === 'files')
                                    .map((m) => (
                                        <li key={m.id}>
                                            <a href={m.original_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                {m.file_name}
                                            </a>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    )}
                </section>

                <Separator />

                {/* Description */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Detailed Description</h2>
                    <Textarea
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        rows={5}
                        placeholder="Describe what happened in detail..."
                    />
                </section>

                <Separator />

                {/* Treatment */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Treatment</h2>
                    <div className="flex items-center gap-3">
                        <Switch checked={data.emergency_services} onCheckedChange={(v) => setData('emergency_services', v)} />
                        <Label>Emergency services called?</Label>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch checked={data.treatment} onCheckedChange={(v) => setData('treatment', v)} />
                        <Label>Was treatment provided?</Label>
                    </div>
                    {data.treatment ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Treatment Date & Time</Label>
                                <Input type="datetime-local" value={data.treatment_at} onChange={(e) => setData('treatment_at', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Treatment Provider</Label>
                                <Input value={data.treatment_provider} onChange={(e) => setData('treatment_provider', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>External Treatment</Label>
                                <Select value={data.treatment_external} onValueChange={(v) => setData('treatment_external', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(options.treatmentExternal).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>External Treatment Location</Label>
                                <Input value={data.treatment_external_location} onChange={(e) => setData('treatment_external_location', e.target.value)} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>Reason no treatment was provided</Label>
                            <Textarea value={data.no_treatment_reason} onChange={(e) => setData('no_treatment_reason', e.target.value)} rows={2} />
                        </div>
                    )}
                </section>

                <Separator />

                {/* Witnesses */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Witnesses</h2>
                    <div className="flex items-center gap-3">
                        <Switch checked={data.witnesses} onCheckedChange={(v) => setData('witnesses', v)} />
                        <Label>Were there witnesses?</Label>
                    </div>
                    {data.witnesses && (
                        <Textarea
                            value={data.witness_details}
                            onChange={(e) => setData('witness_details', e.target.value)}
                            rows={3}
                            placeholder="Witness names and details..."
                        />
                    )}
                </section>

                <Separator />

                {/* Worker Signature */}
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Worker Signature</h2>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Draw signature below</Label>
                        <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => undoPad(workerPadRef)}>
                                <RotateCcw className="mr-1 h-3 w-3" /> Undo
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => clearPad(workerPadRef)}>
                                <Trash2 className="mr-1 h-3 w-3" /> Clear
                            </Button>
                        </div>
                    </div>
                    <canvas ref={workerCanvasRef} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                </section>

                <Separator />

                {/* Representative Sign-off */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">SWC Representative Sign-off</h2>
                    <div className="space-y-2">
                        <Label>Representative</Label>
                        <Select value={data.representative_id} onValueChange={(v) => setData('representative_id', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select representative" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={String(emp.id)}>
                                        {emp.preferred_name ?? emp.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Representative signature</Label>
                            <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => undoPad(repPadRef)}>
                                    <RotateCcw className="mr-1 h-3 w-3" /> Undo
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => clearPad(repPadRef)}>
                                    <Trash2 className="mr-1 h-3 w-3" /> Clear
                                </Button>
                            </div>
                        </div>
                        <canvas ref={repCanvasRef} className="h-32 w-full rounded-md border bg-white" style={{ touchAction: 'none' }} />
                    </div>
                </section>

                <Separator />

                {/* Follow Up */}
                <section className="space-y-4">
                    <h2 className="text-lg font-semibold">Follow Up</h2>
                    <div className="flex items-center gap-3">
                        <Switch checked={data.follow_up ?? false} onCheckedChange={(v) => setData('follow_up', v)} />
                        <Label>Follow up required?</Label>
                    </div>
                    {data.follow_up && (
                        <Textarea
                            value={data.follow_up_notes}
                            onChange={(e) => setData('follow_up_notes', e.target.value)}
                            rows={3}
                            placeholder="Follow up details..."
                        />
                    )}
                </section>

                {/* Submit */}
                <div className="flex items-center justify-end gap-3 border-t pt-6 pb-8">
                    <Button variant="outline" asChild>
                        <Link href="/injury-register">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={processing}>
                        {processing ? 'Saving...' : isEdit ? 'Update Report' : 'Submit Report'}
                    </Button>
                </div>
            </form>
        </AppLayout>
    );
}
