import AddressAutocomplete from '@/components/address-autocomplete';
import BodyLocationCanvas from '@/components/injury-register/BodyLocationCanvas';
import MultiCheckboxSection from '@/components/injury-register/MultiCheckboxSection';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryEmployee, InjuryFormOptions, InjuryLocation } from '@/types/injury';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, FileText, RotateCcw, Trash2, X } from 'lucide-react';
import Dropzone from 'shadcn-dropzone';
import SignaturePad from 'signature_pad';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    injury: Injury | null;
    locations: InjuryLocation[];
    employees: InjuryEmployee[];
    options: InjuryFormOptions;
}

const STEPS = [
    'Incident Type',
    'Worker & Location',
    'Injury Details',
    'Factors & Actions',
    'Description & Files',
    'Treatment & Witnesses',
    'Signatures & Follow Up',
];

export default function InjuryForm({ injury, locations, employees, options }: Props) {
    const isEdit = !!injury;
    const [step, setStep] = useState(0);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Injury Register', href: '/injury-register' },
        { title: isEdit ? `Edit ${injury.id_formal}` : 'Report Incident / Injury', href: '#' },
    ];

    const { data, setData, processing, errors } = useForm({
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
        emergency_services_details: injury?.emergency_services_details ?? '',
        treatment_type: injury?.treatment_type ?? '',
        treatment_details: injury?.treatment_details ?? '',
        follow_up: injury?.follow_up ?? false,
        follow_up_notes: injury?.follow_up_notes ?? '',
        witnesses: injury?.witnesses ?? false,
        witness_details: injury?.witness_details ?? '',
        witness_files: [] as File[],
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
        body_location_image: injury?.body_location_image ?? '',
        files: [] as File[],
    });

    // Signature pads
    const workerCanvasRef = useRef<HTMLCanvasElement>(null);
    const workerPadRef = useRef<SignaturePad | null>(null);
    const repCanvasRef = useRef<HTMLCanvasElement>(null);
    const repPadRef = useRef<SignaturePad | null>(null);
    const sigInitialized = useRef(false);

    const initPad = (canvasRef: React.RefObject<HTMLCanvasElement | null>, padRef: React.MutableRefObject<SignaturePad | null>, existing?: string) => {
        if (!canvasRef.current || padRef.current) return;
        const canvas = canvasRef.current;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        padRef.current = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)',
            minWidth: 1.5,
            maxWidth: 3,
        });
        if (existing) {
            padRef.current.fromDataURL(existing);
        }
    };

    // Init signature pads when we reach step 6 (signatures)
    useEffect(() => {
        if (step === 6 && !sigInitialized.current) {
            // Small delay to ensure canvas is rendered
            const t = setTimeout(() => {
                initPad(workerCanvasRef, workerPadRef, injury?.worker_signature ?? undefined);
                initPad(repCanvasRef, repPadRef, injury?.representative_signature ?? undefined);
                sigInitialized.current = true;
            }, 100);
            return () => clearTimeout(t);
        }
    }, [step]);

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

    const handleSubmit = () => {
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

    // Shared classes
    const inputClass = 'h-12 text-base';
    const selectTriggerClass = 'h-12 text-base';
    const textareaClass = 'text-base';
    const labelClass = 'text-base';

    const YesNoButtons = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
        <div className="space-y-2">
            <Label className={labelClass}>{label}</Label>
            <div className="flex gap-2">
                <Button type="button" variant={value ? 'default' : 'outline'} className="h-12 flex-1 text-base font-semibold" onClick={() => onChange(true)}>Yes</Button>
                <Button type="button" variant={!value ? 'default' : 'outline'} className="h-12 flex-1 text-base font-semibold" onClick={() => onChange(false)}>No</Button>
            </div>
        </div>
    );

    const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
    const goBack = () => setStep((s) => Math.max(s - 1, 0));
    const isLast = step === STEPS.length - 1;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? `Edit ${injury.id_formal}` : 'Report Incident / Injury'} />

            <div className="mx-auto min-w-96 max-w-96 sm:min-w-2xl sm:max-w-2xl p-4">
                {/* Progress Bar */}
                <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">{STEPS[step]}</span>
                        <span className="text-muted-foreground">{step + 1} / {STEPS.length}</span>
                    </div>
                    <div className="bg-muted h-2 rounded-full">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="min-h-[400px] space-y-4">
                    {/* Step 0: Incident Type */}
                    {step === 0 && (
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold">Type of Incident</h2>
                            <div className="space-y-2">
                                <Label className={labelClass}>Incident Type *</Label>
                                <Select value={data.incident} onValueChange={(v) => setData('incident', v)}>
                                    <SelectTrigger className={selectTriggerClass}>
                                        <SelectValue placeholder="Select incident type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(options.incidents).map(([key, label]) => (
                                            <SelectItem key={key} value={key} className="py-3 text-base">{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldError('incident') && <p className="text-sm text-red-500">{fieldError('incident')}</p>}
                            </div>
                            {data.incident === 'other' && (
                                <div className="space-y-2">
                                    <Label className={labelClass}>Other (specify)</Label>
                                    <Input className={inputClass} value={data.incident_other} onChange={(e) => setData('incident_other', e.target.value)} />
                                </div>
                            )}
                        </section>
                    )}

                    {/* Step 1: Worker & Location */}
                    {step === 1 && (
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold">Worker & Location</h2>
                            <div className="space-y-2">
                                <Label className={labelClass}>Worker *</Label>
                                <Select value={data.employee_id} onValueChange={(v) => setData('employee_id', v)}>
                                    <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select worker" /></SelectTrigger>
                                    <SelectContent>
                                        {employees.map((emp) => (
                                            <SelectItem key={emp.id} value={String(emp.id)} className="py-3 text-base">{emp.preferred_name ?? emp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldError('employee_id') && <p className="text-sm text-red-500">{fieldError('employee_id')}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Worker Address</Label>
                                <AddressAutocomplete
                                    className={inputClass}
                                    value={data.employee_address}
                                    onChange={(v) => setData('employee_address', v)}
                                    onSelect={(parts) => setData('employee_address', parts.address)}
                                    placeholder="Start typing address..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Project / Location *</Label>
                                <Select value={data.location_id} onValueChange={(v) => setData('location_id', v)}>
                                    <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select location" /></SelectTrigger>
                                    <SelectContent>
                                        {locations.map((loc) => (
                                            <SelectItem key={loc.id} value={String(loc.id)} className="py-3 text-base">{loc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldError('location_id') && <p className="text-sm text-red-500">{fieldError('location_id')}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Location of Incident</Label>
                                <Input className={inputClass} value={data.location_of_incident} onChange={(e) => setData('location_of_incident', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Date & Time of Occurrence *</Label>
                                <Input className={inputClass} type="datetime-local" value={data.occurred_at} onChange={(e) => setData('occurred_at', e.target.value)} />
                                {fieldError('occurred_at') && <p className="text-sm text-red-500">{fieldError('occurred_at')}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Reported By</Label>
                                <Input className={inputClass} value={data.reported_by} onChange={(e) => setData('reported_by', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Date & Time Reported</Label>
                                <Input className={inputClass} type="datetime-local" value={data.reported_at} onChange={(e) => setData('reported_at', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>Reported To</Label>
                                <Input className={inputClass} value={data.reported_to} onChange={(e) => setData('reported_to', e.target.value)} />
                            </div>
                        </section>
                    )}

                    {/* Step 2: Injury Details */}
                    {step === 2 && (
                        <section className="space-y-6">
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Nature of Injury / Illness</h2>
                                <MultiCheckboxSection title="" options={options.natures} selected={data.natures} onChange={(v) => setData('natures', v)} comments={data.natures_comments} onCommentsChange={(v) => setData('natures_comments', v)} />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Mechanism of Injury</h2>
                                <MultiCheckboxSection title="" options={options.mechanisms} selected={data.mechanisms} onChange={(v) => setData('mechanisms', v)} comments={data.mechanisms_comments} onCommentsChange={(v) => setData('mechanisms_comments', v)} />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Agency of Incident</h2>
                                <MultiCheckboxSection title="" options={options.agencies} selected={data.agencies} onChange={(v) => setData('agencies', v)} comments={data.agencies_comments} onCommentsChange={(v) => setData('agencies_comments', v)} />
                            </div>
                        </section>
                    )}

                    {/* Step 3: Factors & Actions */}
                    {step === 3 && (
                        <section className="space-y-6">
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Contributing Factors</h2>
                                <MultiCheckboxSection title="" options={options.contributions} selected={data.contributions} onChange={(v) => setData('contributions', v)} comments={data.contributions_comments} onCommentsChange={(v) => setData('contributions_comments', v)} />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Corrective Actions</h2>
                                <MultiCheckboxSection title="" options={options.correctiveActions} selected={data.corrective_actions} onChange={(v) => setData('corrective_actions', v)} comments={data.corrective_actions_comments} onCommentsChange={(v) => setData('corrective_actions_comments', v)} />
                            </div>
                        </section>
                    )}

                    {/* Step 4: Description & Files */}
                    {step === 4 && (
                        <section className="space-y-6">
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Detailed Description</h2>
                                <Textarea className={textareaClass} value={data.description} onChange={(e) => setData('description', e.target.value)} rows={5} placeholder="Describe what happened in detail..." />
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Upload incident related files here</h2>
                                <Dropzone onDrop={(files) => setData('files', [...data.files, ...files])} accept={{ 'image/*': [], 'application/pdf': [] }} />
                                {data.files.length > 0 && (
                                    <div className="space-y-2">
                                        {data.files.map((file, i) => (
                                            <div key={i} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                                <FileText size={16} className="text-muted-foreground shrink-0" />
                                                <span className="flex-1 truncate text-sm">{file.name}</span>
                                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setData('files', data.files.filter((_, j) => j !== i))}><X size={14} /></Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {injury?.media && injury.media.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground text-sm">Existing files:</Label>
                                        {injury.media.filter((m) => m.collection_name === 'files').map((m) => (
                                            <div key={m.id} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                                <FileText size={16} className="text-muted-foreground shrink-0" />
                                                <a href={m.original_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-sm text-blue-600 hover:underline">{m.file_name}</a>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Body Location <span className="text-muted-foreground text-sm font-normal">(optional)</span></h2>
                                <BodyLocationCanvas value={data.body_location_image || null} onChange={(dataUrl) => setData('body_location_image', dataUrl)} />
                            </div>
                        </section>
                    )}

                    {/* Step 5: Treatment & Witnesses */}
                    {step === 5 && (
                        <section className="space-y-6">
                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Emergency Services</h2>
                                <YesNoButtons label="Emergency services called?" value={data.emergency_services} onChange={(v) => setData('emergency_services', v)} />
                                {data.emergency_services && (
                                    <div className="space-y-2">
                                        <Label className={labelClass}>Provide details</Label>
                                        <Input className={inputClass} value={data.emergency_services_details} onChange={(e) => setData('emergency_services_details', e.target.value)} placeholder="Provide details..." />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Type of treatment provided</h2>
                                <div className="space-y-2">
                                    <Label className={labelClass}>Type of treatment provided</Label>
                                    <Select value={data.treatment_type} onValueChange={(v) => setData('treatment_type', v)}>
                                        <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select treatment type..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="first_aid" className="py-3 text-base">First Aid only</SelectItem>
                                            <SelectItem value="medical_centre" className="py-3 text-base">Medical Centre/GP</SelectItem>
                                            <SelectItem value="hospital" className="py-3 text-base">Hospital</SelectItem>
                                            <SelectItem value="other" className="py-3 text-base">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {data.treatment_type === 'first_aid' && (
                                    <div className="space-y-2">
                                        <Label className={labelClass}>Details of the person who provided First Aid</Label>
                                        <Input className={inputClass} value={data.treatment_details} onChange={(e) => setData('treatment_details', e.target.value)} placeholder="Enter name and details of person who provided First Aid..." />
                                    </div>
                                )}
                                {data.treatment_type === 'medical_centre' && (
                                    <div className="space-y-2">
                                        <Label className={labelClass}>Name & Address of the Medical Centre</Label>
                                        <Input className={inputClass} value={data.treatment_details} onChange={(e) => setData('treatment_details', e.target.value)} placeholder="Enter name and address of Medical Centre..." />
                                    </div>
                                )}
                                {data.treatment_type === 'hospital' && (
                                    <div className="space-y-2">
                                        <Label className={labelClass}>Name & Address of the Hospital</Label>
                                        <Input className={inputClass} value={data.treatment_details} onChange={(e) => setData('treatment_details', e.target.value)} placeholder="Enter name and address of Hospital..." />
                                    </div>
                                )}
                                {data.treatment_type === 'other' && (
                                    <div className="space-y-2">
                                        <Label className={labelClass}>Additional details</Label>
                                        <Input className={inputClass} value={data.treatment_details} onChange={(e) => setData('treatment_details', e.target.value)} placeholder="Enter additional details..." />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Witnesses</h2>
                                <YesNoButtons label="Were there any witnesses to the reported event?" value={data.witnesses} onChange={(v) => setData('witnesses', v)} />
                                {data.witnesses && (
                                    <div className="space-y-4">
                                        <Textarea className={textareaClass} value={data.witness_details} onChange={(e) => setData('witness_details', e.target.value)} rows={3} placeholder="Please enter witness name and contact details or select worker if they are a current employee..." />
                                        <div className="space-y-2">
                                            <Label className={labelClass}>Upload witness report form</Label>
                                            <Dropzone onDrop={(files) => setData('witness_files', [...data.witness_files, ...files])} accept={{ 'image/*': [], 'application/pdf': [] }}>
                                                {(dropzone) => (
                                                    <div className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${dropzone.isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
                                                        <p className="text-muted-foreground text-sm">Drop witness report form here or click to browse</p>
                                                    </div>
                                                )}
                                            </Dropzone>
                                            {data.witness_files.length > 0 && (
                                                <div className="space-y-2">
                                                    {data.witness_files.map((file, i) => (
                                                        <div key={i} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                                            <FileText size={16} className="text-muted-foreground shrink-0" />
                                                            <span className="flex-1 truncate text-sm">{file.name}</span>
                                                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setData('witness_files', data.witness_files.filter((_, j) => j !== i))}><X size={14} /></Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Step 6: Signatures & Follow Up */}
                    {step === 6 && (
                        <section className="space-y-6">
                            <div className="space-y-3">
                                <h2 className="text-lg font-semibold">Worker Sign Off <span className="text-muted-foreground text-sm font-normal">(Person involved in this incident)</span></h2>
                                <div className="bg-muted/50 rounded-md border px-4 py-3 text-sm">
                                    <strong>NOTE:</strong> By signing below you agree that the information provided in this report is correct and an accurate account of the incident / injury being reported.
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">Draw signature below</Label>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-sm" onClick={() => undoPad(workerPadRef)}>
                                            <RotateCcw className="mr-1.5 h-4 w-4" /> Undo
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-sm" onClick={() => clearPad(workerPadRef)}>
                                            <Trash2 className="mr-1.5 h-4 w-4" /> Clear
                                        </Button>
                                    </div>
                                </div>
                                <canvas ref={workerCanvasRef} className="h-44 w-full rounded-md border bg-white dark:invert" style={{ touchAction: 'none' }} />
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">SWC Representative Sign-off</h2>
                                <div className="space-y-2">
                                    <Label className={labelClass}>Representative</Label>
                                    <Select value={data.representative_id} onValueChange={(v) => setData('representative_id', v)}>
                                        <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Select representative" /></SelectTrigger>
                                        <SelectContent>
                                            {employees.map((emp) => (
                                                <SelectItem key={emp.id} value={String(emp.id)} className="py-3 text-base">{emp.preferred_name ?? emp.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm">Representative signature</Label>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-sm" onClick={() => undoPad(repPadRef)}>
                                                <RotateCcw className="mr-1.5 h-4 w-4" /> Undo
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" className="h-10 px-3 text-sm" onClick={() => clearPad(repPadRef)}>
                                                <Trash2 className="mr-1.5 h-4 w-4" /> Clear
                                            </Button>
                                        </div>
                                    </div>
                                    <canvas ref={repCanvasRef} className="h-44 w-full rounded-md border bg-white dark:invert" style={{ touchAction: 'none' }} />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-lg font-semibold">Follow Up</h2>
                                <YesNoButtons label="Follow up required?" value={data.follow_up ?? false} onChange={(v) => setData('follow_up', v)} />
                                {data.follow_up && (
                                    <Textarea className={textareaClass} value={data.follow_up_notes} onChange={(e) => setData('follow_up_notes', e.target.value)} rows={3} placeholder="Follow up details..." />
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between border-t pt-6 pb-8 mt-6">
                    <div>
                        {step > 0 ? (
                            <Button type="button" variant="outline" size="lg" className="h-12 px-6 text-base" onClick={goBack}>
                                <ChevronLeft className="mr-1 h-5 w-5" /> Back
                            </Button>
                        ) : (
                            <Button variant="outline" size="lg" className="h-12 px-6 text-base" asChild>
                                <Link href="/injury-register">Cancel</Link>
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {isLast ? (
                            <Button size="lg" className="h-12 px-8 text-base" onClick={handleSubmit} disabled={processing}>
                                {processing ? 'Saving...' : isEdit ? 'Update Report' : 'Submit Report'}
                            </Button>
                        ) : (
                            <Button size="lg" className="h-12 px-8 text-base" type="button" onClick={goNext}>
                                Next <ChevronRight className="ml-1 h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
