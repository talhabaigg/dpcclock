import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryFormOptions } from '@/types/injury';
import { Head, Link, router } from '@inertiajs/react';
import { Lock, Pencil, Unlock } from 'lucide-react';

interface Props {
    injury: Injury;
    options: InjuryFormOptions;
}

function Field({ label, value, className }: { label: string; value?: string | number | null; className?: string }) {
    return (
        <div className={className}>
            <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
            <dd className="mt-0.5 text-sm">{value || '—'}</dd>
        </div>
    );
}

function BoolField({ label, value }: { label: string; value: boolean }) {
    return (
        <div>
            <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
            <dd className="mt-0.5 text-sm">{value ? 'Yes' : 'No'}</dd>
        </div>
    );
}

function CheckedItems({ options, selected }: { options: Record<string, string>; selected: string[] | null }) {
    if (!selected || selected.length === 0) return <span className="text-muted-foreground text-sm">None selected</span>;
    return (
        <div className="flex flex-wrap gap-1">
            {selected.map((key) => (
                <Badge key={key} variant="secondary" className="text-xs">
                    {options[key] ?? key}
                </Badge>
            ))}
        </div>
    );
}

export default function InjuryShow({ injury, options }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Injury Register', href: '/injury-register' },
        { title: injury.id_formal, href: '#' },
    ];

    const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('en-AU') : '—');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={injury.id_formal} />

            <div className="mx-auto max-w-4xl space-y-6 p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{injury.id_formal}</h1>
                        <InjuryStatusBadge reportType={injury.report_type} label={injury.report_type_label} />
                        {injury.locked_at && <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>}
                    </div>
                    <div className="flex gap-2">
                        {!injury.locked_at && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/injury-register/${injury.id}/edit`}>
                                    <Pencil className="mr-1 h-3 w-3" /> Edit
                                </Link>
                            </Button>
                        )}
                        {!injury.locked_at ? (
                            <Button variant="outline" size="sm" onClick={() => router.post(`/injury-register/${injury.id}/lock`, {}, { preserveScroll: true })}>
                                <Lock className="mr-1 h-3 w-3" /> Lock
                            </Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => router.post(`/injury-register/${injury.id}/unlock`, {}, { preserveScroll: true })}>
                                <Unlock className="mr-1 h-3 w-3" /> Unlock
                            </Button>
                        )}
                    </div>
                </div>

                {/* Incident Info */}
                <Card>
                    <CardHeader><CardTitle>Incident Details</CardTitle></CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Field label="Incident Type" value={injury.incident_label} />
                            {injury.incident === 'other' && <Field label="Other" value={injury.incident_other} />}
                            <Field label="Report Type" value={injury.report_type_label} />
                        </dl>
                    </CardContent>
                </Card>

                {/* Worker & Location */}
                <Card>
                    <CardHeader><CardTitle>Worker & Location</CardTitle></CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Field label="Worker" value={injury.employee?.preferred_name ?? injury.employee?.name} />
                            <Field label="Worker Address" value={injury.employee_address} />
                            <Field label="Project / Location" value={injury.location?.name} />
                            <Field label="Location of Incident" value={injury.location_of_incident} />
                            <Field label="Occurred At" value={fmtDate(injury.occurred_at)} />
                            <Field label="Reported By" value={injury.reported_by} />
                            <Field label="Reported At" value={fmtDate(injury.reported_at)} />
                            <Field label="Reported To" value={injury.reported_to} />
                        </dl>
                    </CardContent>
                </Card>

                {/* Multi-select sections */}
                <Card>
                    <CardHeader><CardTitle>Nature of Injury / Illness</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <CheckedItems options={options.natures} selected={injury.natures} />
                        {injury.natures_comments && <p className="text-muted-foreground text-sm">{injury.natures_comments}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Mechanism of Injury</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <CheckedItems options={options.mechanisms} selected={injury.mechanisms} />
                        {injury.mechanisms_comments && <p className="text-muted-foreground text-sm">{injury.mechanisms_comments}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Agency of Incident</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <CheckedItems options={options.agencies} selected={injury.agencies} />
                        {injury.agencies_comments && <p className="text-muted-foreground text-sm">{injury.agencies_comments}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Contributing Factors</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <CheckedItems options={options.contributions} selected={injury.contributions} />
                        {injury.contributions_comments && <p className="text-muted-foreground text-sm">{injury.contributions_comments}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Corrective Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <CheckedItems options={options.correctiveActions} selected={injury.corrective_actions} />
                        {injury.corrective_actions_comments && <p className="text-muted-foreground text-sm">{injury.corrective_actions_comments}</p>}
                    </CardContent>
                </Card>

                {/* Description */}
                <Card>
                    <CardHeader><CardTitle>Detailed Description</CardTitle></CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-sm">{injury.description || '—'}</p>
                    </CardContent>
                </Card>

                {/* Treatment */}
                <Card>
                    <CardHeader><CardTitle>Treatment</CardTitle></CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <BoolField label="Emergency Services Called" value={injury.emergency_services} />
                            <BoolField label="WorkCover Claim" value={injury.work_cover_claim} />
                            <BoolField label="Treatment Provided" value={injury.treatment} />
                            {injury.treatment ? (
                                <>
                                    <Field label="Treatment Date" value={fmtDate(injury.treatment_at)} />
                                    <Field label="Treatment Provider" value={injury.treatment_provider} />
                                    <Field label="External Treatment" value={injury.treatment_external ? options.treatmentExternal[injury.treatment_external] : null} />
                                    <Field label="External Location" value={injury.treatment_external_location} />
                                </>
                            ) : (
                                <Field label="Reason (No Treatment)" value={injury.no_treatment_reason} className="sm:col-span-2" />
                            )}
                            <Field label="Work Days Missed" value={injury.work_days_missed} />
                        </dl>
                    </CardContent>
                </Card>

                {/* Witnesses */}
                <Card>
                    <CardHeader><CardTitle>Witnesses</CardTitle></CardHeader>
                    <CardContent>
                        <BoolField label="Witnesses Present" value={injury.witnesses} />
                        {injury.witnesses && injury.witness_details && (
                            <p className="mt-2 whitespace-pre-wrap text-sm">{injury.witness_details}</p>
                        )}
                    </CardContent>
                </Card>

                {/* Signatures */}
                {(injury.worker_signature || injury.representative_signature) && (
                    <Card>
                        <CardHeader><CardTitle>Signatures</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {injury.worker_signature && (
                                <div>
                                    <p className="text-muted-foreground mb-1 text-xs font-medium">Worker Signature</p>
                                    <img src={injury.worker_signature} alt="Worker signature" className="h-24 rounded border bg-white" />
                                </div>
                            )}
                            {injury.representative_signature && (
                                <div>
                                    <p className="text-muted-foreground mb-1 text-xs font-medium">
                                        Representative Signature
                                        {injury.representative && ` — ${injury.representative.preferred_name ?? injury.representative.name}`}
                                    </p>
                                    <img src={injury.representative_signature} alt="Representative signature" className="h-24 rounded border bg-white" />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Files */}
                {injury.media && injury.media.filter((m) => m.collection_name === 'files').length > 0 && (
                    <Card>
                        <CardHeader><CardTitle>Attached Files</CardTitle></CardHeader>
                        <CardContent>
                            <ul className="space-y-1">
                                {injury.media
                                    .filter((m) => m.collection_name === 'files')
                                    .map((m) => (
                                        <li key={m.id}>
                                            <a href={m.original_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                                                {m.file_name}
                                            </a>
                                        </li>
                                    ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                {/* Follow Up */}
                <Card>
                    <CardHeader><CardTitle>Follow Up</CardTitle></CardHeader>
                    <CardContent>
                        <BoolField label="Follow Up Required" value={injury.follow_up ?? false} />
                        {injury.follow_up && injury.follow_up_notes && (
                            <p className="mt-2 whitespace-pre-wrap text-sm">{injury.follow_up_notes}</p>
                        )}
                    </CardContent>
                </Card>

                {/* Meta */}
                <Card>
                    <CardContent className="pt-6">
                        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                            <Field label="Created By" value={injury.creator?.name} />
                            <Field label="Created At" value={fmtDate(injury.created_at)} />
                            <Field label="Updated At" value={fmtDate(injury.updated_at)} />
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
