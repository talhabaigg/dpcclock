import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckIcon, XIcon } from 'lucide-react';

interface Skill {
    id: number;
    skill_name: string;
    is_custom: boolean;
}

interface Reference {
    id: number;
    sort_order: number;
    company_name: string;
    position: string;
    employment_period: string;
    contact_person: string;
    phone_number: string;
}

interface Application {
    id: number;
    first_name: string;
    surname: string;
    suburb: string;
    email: string;
    phone: string;
    date_of_birth: string;
    why_should_we_employ_you: string;
    referred_by: string | null;
    aboriginal_or_tsi: boolean | null;
    occupation: string;
    apprentice_year: number | null;
    trade_qualified: boolean | null;
    occupation_other: string | null;
    preferred_project_site: string | null;
    safety_induction_number: string;
    ewp_below_11m: boolean;
    ewp_above_11m: boolean;
    forklift_licence_number: string | null;
    work_safely_at_heights: boolean;
    scaffold_licence_number: string | null;
    first_aid_completion_date: string | null;
    workplace_impairment_training: boolean;
    wit_completion_date: string | null;
    asbestos_awareness_training: boolean;
    crystalline_silica_course: boolean;
    gender_equity_training: boolean;
    quantitative_fit_test: string;
    workcover_claim: boolean | null;
    medical_condition: string | null;
    medical_condition_other: string | null;
    acceptance_full_name: string;
    acceptance_email: string;
    acceptance_date: string;
    declaration_accepted: boolean;
    created_at: string;
    skills: Skill[];
    references: Reference[];
}

interface PageProps {
    application: Application;
}

const SECTIONS = [
    { label: 'Personal Details' },
    { label: 'Occupation & Skills' },
    { label: 'Licences & Tickets' },
    { label: 'References' },
    { label: 'Medical & Declaration' },
];

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <span className="text-sm">{value || '—'}</span>
        </div>
    );
}

function BoolField({ value, label }: { value: boolean | null | undefined; label: string }) {
    if (value === null || value === undefined) return <Field label={label} value="—" />;
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <div className="flex items-center gap-1.5">
                {value ? (
                    <CheckIcon className="h-4 w-4 text-emerald-600" />
                ) : (
                    <XIcon className="h-4 w-4 text-red-400" />
                )}
                <span className="text-sm">{value ? 'Yes' : 'No'}</span>
            </div>
        </div>
    );
}

function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Submission({ application: app }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Applications', href: '/employment-applications' },
        { title: `${app.first_name} ${app.surname}`, href: `/employment-applications/${app.id}` },
        { title: 'Full Submission', href: `/employment-applications/${app.id}/submission` },
    ];

    const occupationDisplay =
        app.occupation === 'other' && app.occupation_other
            ? app.occupation_other
            : app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);

    const masterSkills = app.skills.filter((s) => !s.is_custom);
    const customSkills = app.skills.filter((s) => s.is_custom);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${app.first_name} ${app.surname} — Full Submission`} />

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-3 sm:p-6">
                {/* Back link */}
                <Link
                    href={`/employment-applications/${app.id}`}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to application
                </Link>

                {/* Section indicator */}
                <div className="flex items-center justify-between px-2">
                    {SECTIONS.map((s, i) => (
                        <div key={i} className="flex items-center">
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="bg-primary border-primary text-primary-foreground flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold">
                                    <CheckIcon className="size-4" />
                                </div>
                                <span className="text-muted-foreground hidden text-center text-xs font-medium sm:block">
                                    {s.label}
                                </span>
                            </div>
                            {i < SECTIONS.length - 1 && <div className="bg-primary mx-1 h-0.5 w-6 sm:w-12" />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Personal Details */}
                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Personal Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Surname" value={app.surname} />
                            <Field label="First Name(s)" value={app.first_name} />
                        </div>
                        <Field label="Suburb" value={app.suburb} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Email" value={app.email} />
                            <Field label="Phone" value={app.phone} />
                        </div>
                        <Field label="Date of Birth" value={formatDate(app.date_of_birth)} />
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs font-medium">Why should we employ you?</span>
                            <p className="text-sm whitespace-pre-wrap">{app.why_should_we_employ_you || '—'}</p>
                        </div>
                        <Field label="Referred By" value={app.referred_by} />
                        <BoolField label="Aboriginal or Torres Strait Islander Origin" value={app.aboriginal_or_tsi} />
                    </CardContent>
                </Card>

                {/* Step 2: Occupation & Skills */}
                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Occupation</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Field label="Occupation" value={occupationDisplay} />
                        <Field label="Apprentice Year" value={app.apprentice_year ? `Year ${app.apprentice_year}` : 'Not an apprentice'} />
                        <BoolField label="Trade Qualified" value={app.trade_qualified} />
                        <Field label="Preferred Project/Site" value={app.preferred_project_site} />
                    </CardContent>
                </Card>

                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Skills</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {masterSkills.length > 0 && (
                            <div className="grid gap-1">
                                <span className="text-muted-foreground text-xs font-medium">Selected Skills</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {masterSkills.map((s) => (
                                        <Badge key={s.id} variant="secondary" className="text-xs">
                                            {s.skill_name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        {customSkills.length > 0 && (
                            <div className="grid gap-1">
                                <span className="text-muted-foreground text-xs font-medium">Other Skills</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {customSkills.map((s) => (
                                        <Badge key={s.id} variant="outline" className="text-xs">
                                            {s.skill_name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        {app.skills.length === 0 && <p className="text-muted-foreground text-sm">No skills listed.</p>}
                    </CardContent>
                </Card>

                {/* Step 3: Licences & Tickets */}
                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Licence & Ticket Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <Field label="Building Industry General Safety Induction Number" value={app.safety_induction_number} />

                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs font-medium">EWP Operator Licence</span>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                    {app.ewp_below_11m ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <XIcon className="h-4 w-4 text-red-400" />}
                                    <span className="text-sm">Below 11m</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {app.ewp_above_11m ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <XIcon className="h-4 w-4 text-red-400" />}
                                    <span className="text-sm">Above 11m (high risk)</span>
                                </div>
                            </div>
                        </div>

                        <Field label="Fork Lift Licence Number" value={app.forklift_licence_number} />
                        <BoolField label="Work Safely at Heights Training" value={app.work_safely_at_heights} />
                        <Field label="Scaffold Licence Number" value={app.scaffold_licence_number} />
                        <Field label="First Aid Certificate Completion Date" value={formatDate(app.first_aid_completion_date)} />

                        <Separator />

                        <BoolField label="Workplace Impairment Training (WIT)" value={app.workplace_impairment_training} />
                        {app.workplace_impairment_training && (
                            <Field label="WIT Completion Date" value={formatDate(app.wit_completion_date)} />
                        )}
                        <BoolField label="Asbestos Awareness Training" value={app.asbestos_awareness_training} />
                        <BoolField label="10830NAT Crystalline Silica Course" value={app.crystalline_silica_course} />
                        <BoolField label="Gender Equity Training" value={app.gender_equity_training} />
                        <Field
                            label="Quantitative Fit Test"
                            value={app.quantitative_fit_test === 'quantitative' ? 'Quantitative' : 'No fit test completed'}
                        />
                    </CardContent>
                </Card>

                {/* Step 4: References */}
                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Employment References</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        {app.references.map((ref, index) => (
                            <div key={ref.id}>
                                {index > 0 && <Separator className="mb-6" />}
                                <h4 className="mb-3 text-sm font-medium">Reference {ref.sort_order}</h4>
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Company Name" value={ref.company_name} />
                                        <Field label="Position" value={ref.position} />
                                    </div>
                                    <Field label="Employment Period" value={ref.employment_period} />
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="Contact Person" value={ref.contact_person} />
                                        <Field label="Phone Number" value={ref.phone_number} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {app.references.length === 0 && <p className="text-muted-foreground text-sm">No references provided.</p>}
                    </CardContent>
                </Card>

                {/* Step 5: Medical & Declaration */}
                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Medical History</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <BoolField label="Workcover Claim (last 2 years)" value={app.workcover_claim} />
                        <Field
                            label="Medical or Physical Condition"
                            value={
                                app.medical_condition === 'none' || !app.medical_condition
                                    ? 'None'
                                    : app.medical_condition === 'other'
                                      ? app.medical_condition_other
                                      : app.medical_condition.charAt(0).toUpperCase() + app.medical_condition.slice(1) + ' condition'
                            }
                        />
                    </CardContent>
                </Card>

                <Card className="rounded-xl">
                    <CardHeader>
                        <CardTitle>Declaration & Acceptance</CardTitle>
                        <CardDescription>
                            I declare that the information provided in this application is true and correct. I understand that
                            providing false or misleading information may result in termination of employment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Full Name" value={app.acceptance_full_name} />
                            <Field label="Email Address" value={app.acceptance_email} />
                        </div>
                        <Field label="Date" value={formatDate(app.acceptance_date)} />
                        <BoolField label="Declaration Accepted" value={app.declaration_accepted} />
                    </CardContent>
                </Card>

                {/* Submitted timestamp */}
                <p className="text-muted-foreground text-center text-xs">Submitted on {formatDate(app.created_at)}</p>
            </div>
        </AppLayout>
    );
}
