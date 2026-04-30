import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { format, parse } from 'date-fns';
import { ArrowLeft, CalendarIcon, CheckCircle2 } from 'lucide-react';

interface ApplicationData {
    id: number;
    first_name: string;
    surname: string;
    email: string | null;
    phone: string | null;
    occupation: string;
    occupation_other: string | null;
    preferred_project_site: string | null;
    why_should_we_employ_you: string | null;
    safety_induction_number: string | null;
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
    quantitative_fit_test: string | null;
    workcover_claim: boolean | null;
    medical_condition: string | null;
    medical_condition_other: string | null;
}

interface InterviewerEntry {
    name: string;
    position: string;
    date: string;
}

interface ExistingInterview {
    id: number;
    interview_method: string | null;
    interviewer_names: string[] | null;
    position_applied_for: string[] | null;
    position_other: string | null;
    preferred_position: string[] | null;
    location_preference: string[] | null;
    location_other: string | null;
    why_employ_response: string | null;
    contract_employer_aware: string | null;
    perceived_honesty_ethic: string | null;
    matches_reference_checks: string | null;
    punctuality_perception: string | null;
    punctuality_acknowledged: string | null;
    family_holidays: string | null;
    family_holidays_dates: string | null;
    safe_environment_acknowledged: string | null;
    has_tools: string | null;
    tools_discussion: string | null;
    tools_tagged_in_date: string | null;
    tagging_acknowledged: string | null;
    productivity_acknowledged: string | null;
    productivity_discussion: string | null;
    white_card_number: string | null;
    white_card_date: string | null;
    white_card_attached: boolean | null;
    ewp_licence_type: string | null;
    ewp_licence_number: string | null;
    ewp_licence_date: string | null;
    ewp_licence_attached: boolean | null;
    high_risk_licence_type: string | null;
    high_risk_licence_number: string | null;
    high_risk_licence_date: string | null;
    high_risk_licence_attached: boolean | null;
    heights_training_date: string | null;
    heights_training_attached: boolean | null;
    scaffold_licence_number: string | null;
    scaffold_licence_date: string | null;
    scaffold_licence_attached: boolean | null;
    wit_completed: string | null;
    wit_date: string | null;
    fit_test_completed: string | null;
    fit_test_method: string | null;
    willing_to_undergo_fit_test: string | null;
    asbestos_awareness: string | null;
    silica_awareness: string | null;
    mental_health_awareness: string | null;
    first_aid_date: string | null;
    first_aid_refresher_date: string | null;
    aware_of_collective_agreement: string | null;
    agree_to_discuss_with_rep: string | null;
    workcover_claim_discussed: string | null;
    medical_condition_discussed: string | null;
    medical_discussion_notes: string | null;
    disclosure_consequences_acknowledged: string | null;
    can_work_overhead: string | null;
    can_walk_stand: string | null;
    can_lift_carry: string | null;
    can_work_at_heights: string | null;
    can_operate_power_tools: string | null;
    can_perform_repetitive: string | null;
    can_operate_plant: string | null;
    reference_checks_clarification: string | null;
    reference_checks_discussion: string | null;
    reason_for_leaving: string[] | null;
    reason_for_leaving_other: string | null;
    applicant_questions: string | null;
    presentation_reasonable: string | null;
    is_interested: string | null;
    reviewed_contract: string | null;
    was_organised: string | null;
    additional_notes: string | null;
    interviewers: InterviewerEntry[] | null;
    completed_at: string | null;
    completed_by_user: { id: number; name: string } | null;
}

interface InterviewerOption {
    id: number;
    name: string;
}

interface PageProps {
    application: ApplicationData;
    interviewerOptions: InterviewerOption[];
    existingInterview: ExistingInterview | null;
}

const POSITION_OPTIONS = [
    { value: 'plasterer', label: 'Plasterer' },
    { value: 'carpenter', label: 'Carpenter' },
    { value: 'labourer', label: 'Labourer' },
    { value: 'other', label: 'Other (e.g. Apprentice)' },
];

const PREFERRED_POSITION_OPTIONS = [
    'Erecting Framework',
    'Concealed Grid',
    'Setting',
    'Set Out',
    'Fix Plasterboard',
    'Exposed Grid',
    'Cornice',
    'Other',
];

const LOCATION_OPTIONS = [
    { value: 'gold_coast', label: 'Gold Coast' },
    { value: 'brisbane', label: 'Brisbane' },
    { value: 'sunshine_coast', label: 'Sunshine Coast' },
    { value: 'northern_rivers', label: 'Northern Rivers' },
    { value: 'other', label: 'Other' },
];

const PERFORMANCE_OPTIONS = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'very_good', label: 'Very Good' },
    { value: 'good', label: 'Good' },
    { value: 'average', label: 'Average' },
    { value: 'poor', label: 'Poor' },
];

const REASON_FOR_LEAVING_OPTIONS = [
    { value: 'end_of_project', label: 'End of Project / Redundancy' },
    { value: 'family_health', label: 'Family / Health' },
    { value: 'terminated', label: 'Terminated' },
    { value: 'relocated', label: 'Relocated' },
    { value: 'looking_for_change', label: 'Looking for change' },
    { value: 'other', label: 'Other' },
];

const FIT_TEST_OPTIONS = [
    { value: 'quantitative', label: 'Quantitative' },
    { value: 'qualitative', label: 'Qualitative' },
    { value: 'not_fitted', label: 'Not fitted' },
    { value: 'unable', label: 'Unable to provide' },
];

const INTERVIEW_METHOD_OPTIONS = [
    { value: 'in_person', label: 'In person' },
    { value: 'phone', label: 'Phone' },
    { value: 'video', label: 'Video' },
];

const TASK_QUESTIONS: { key: keyof ExistingInterview; label: string }[] = [
    { key: 'can_work_overhead', label: 'Working overhead' },
    { key: 'can_walk_stand', label: 'Walking or standing' },
    { key: 'can_lift_carry', label: 'Lifting and carrying' },
    { key: 'can_work_at_heights', label: 'Working at heights' },
    { key: 'can_operate_power_tools', label: 'Operating power tools' },
    { key: 'can_perform_repetitive', label: 'Repetitive movements' },
    { key: 'can_operate_plant', label: 'Operating plant' },
];

function formatOccupation(app: ApplicationData) {
    return app.occupation === 'other' && app.occupation_other
        ? app.occupation_other
        : app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);
}

function formatDate(val: string | null | undefined) {
    if (!val) return '—';
    return new Date(val).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SectionHeading({ part, title, description }: { part: string; title: string; description?: string }) {
    return (
        <div className="mb-4">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{part}</p>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
    );
}

function ReadField({ label, value }: { label: string; value: string | boolean | null | undefined }) {
    const display = value === null || value === undefined || value === '' ? '—' : String(value);
    return (
        <div className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            <span className="text-sm">{display}</span>
        </div>
    );
}

function BadgeField({ label, values }: { label: string; values: string[] }) {
    return (
        <div className="grid gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">{label}</span>
            {values.length === 0 ? (
                <span className="text-sm">—</span>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {values.map((v, i) => (
                        <Badge key={i} variant="secondary">
                            {v}
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

function YesNoLabel(value: string | null | undefined) {
    if (!value) return null;
    const map: Record<string, string> = { yes: 'Yes', no: 'No', unsure: 'Unsure', na: 'N/A' };
    return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Touch-friendly segmented option buttons. Mirrors the injury-register YesNoButtons pattern:
 * each option is a full-height button (h-12) so it's easy to tap on tablets and phones.
 */
function OptionButtons({
    value,
    onChange,
    options = ['yes', 'no'],
    labels,
    columns,
}: {
    value: string;
    onChange: (v: string) => void;
    options?: string[];
    labels?: Record<string, string>;
    columns?: number;
    /** legacy / ignored — kept so the same call signature works for CheckboxGroup → OptionButtons migrations */
    name?: string;
}) {
    const labelMap: Record<string, string> = {
        yes: 'Yes',
        no: 'No',
        unsure: 'Unsure',
        na: 'N/A',
        sometimes: 'Sometimes',
        ...labels,
    };
    const desktopCols = columns ?? Math.min(options.length, 5);
    // Cap mobile at 2 columns so each button stays tappable; desktop uses configured count.
    const mobileGrid = options.length === 2 ? 'grid-cols-2' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
    const desktopGridMap: Record<number, string> = {
        2: 'sm:grid-cols-2',
        3: 'sm:grid-cols-3',
        4: 'sm:grid-cols-4',
        5: 'sm:grid-cols-5',
    };
    return (
        <div className={cn('grid gap-2', mobileGrid, desktopGridMap[desktopCols] ?? 'sm:grid-cols-3')}>
            {options.map((opt) => (
                <Button
                    key={opt}
                    type="button"
                    variant={value === opt ? 'default' : 'outline'}
                    onClick={() => onChange(value === opt ? '' : opt)}
                    className="h-12 text-sm font-semibold"
                >
                    {labelMap[opt] ?? opt}
                </Button>
            ))}
        </div>
    );
}

/** Shadcn-style date picker (Popover + Calendar) so dates are input the same way everywhere. */
function DateField({
    id,
    value,
    onChange,
    placeholder = 'Select date',
}: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const date = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    id={id}
                    variant="outline"
                    className={cn(
                        'h-11 w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground',
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                    {date ? format(date, 'dd MMM yyyy') : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    captionLayout="dropdown"
                    defaultMonth={date}
                    onSelect={(next) => onChange(next ? format(next, 'yyyy-MM-dd') : '')}
                />
            </PopoverContent>
        </Popover>
    );
}

interface LicenceReadRowProps {
    title: string;
    type?: string | null;
    number?: string | null;
    date?: string | null;
    attached?: boolean | null;
}

function LicenceReadRow({ title, type, number, date, attached }: LicenceReadRowProps) {
    const hasAny = type || number || date || attached;
    return (
        <div className="bg-muted/30 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
                <span className="text-sm">
                    {hasAny ? (
                        <>
                            {type && <Badge variant="secondary" className="mr-2">{type}</Badge>}
                            {number ?? <span className="text-muted-foreground">No number</span>}
                        </>
                    ) : (
                        <span className="text-muted-foreground">Not provided</span>
                    )}
                </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground text-xs">{formatDate(date)}</span>
                {attached === true && (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                        Copy attached
                    </Badge>
                )}
            </div>
        </div>
    );
}

/** Touch-friendly multi-select — each option is a full-height button card that toggles on tap. */
function OptionCheckboxes({
    options,
    values,
    onToggle,
    columns = 3,
}: {
    options: { value: string; label: string }[] | string[];
    values: string[];
    onToggle: (v: string) => void;
    /** Desktop column count. Mobile always wraps at 2 columns. */
    columns?: number;
    /** legacy / ignored — kept so the same call signature works for CheckboxGroup → OptionCheckboxes migrations */
    name?: string;
}) {
    const normalised = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    const desktopCols = columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3';
    return (
        <div className={cn('grid grid-cols-2 gap-2', desktopCols)}>
            {normalised.map((opt) => {
                const active = values.includes(opt.value);
                return (
                    <Button
                        key={opt.value}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => onToggle(opt.value)}
                        className={cn(
                            'h-12 justify-start whitespace-normal text-left text-sm font-medium',
                            active && 'shadow-sm',
                        )}
                    >
                        <span className={cn(
                            'mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                            active ? 'border-primary-foreground bg-primary-foreground/20' : 'border-current opacity-50',
                        )}>
                            {active && <CheckIconSmall />}
                        </span>
                        <span className="flex-1">{opt.label}</span>
                    </Button>
                );
            })}
        </div>
    );
}

function CheckIconSmall() {
    return (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3.5,8.5 7,12 12.5,4" />
        </svg>
    );
}

function prefillFromApplication(app: ApplicationData) {
    const positions: string[] = [];
    if (POSITION_OPTIONS.some((p) => p.value === app.occupation)) {
        positions.push(app.occupation);
    } else if (app.occupation) {
        positions.push('other');
    }

    const locations: string[] = [];
    let locationOther = '';
    if (app.preferred_project_site) {
        const slug = app.preferred_project_site.toLowerCase().replace(/\s+/g, '_');
        const match = LOCATION_OPTIONS.find((l) => l.value === slug);
        if (match) {
            locations.push(match.value);
        } else {
            locations.push('other');
            locationOther = app.preferred_project_site;
        }
    }

    let highRiskType = '';
    let highRiskNumber = '';
    if (app.forklift_licence_number) {
        highRiskType = 'FL';
        highRiskNumber = app.forklift_licence_number;
    }

    let fitTest = '';
    if (app.quantitative_fit_test) {
        const v = app.quantitative_fit_test.toLowerCase();
        if (v.includes('quantitative')) fitTest = 'quantitative';
        else if (v.includes('qualitative')) fitTest = 'qualitative';
        else if (v.includes('not')) fitTest = 'not_fitted';
        else if (v.includes('unable')) fitTest = 'unable';
    }

    const ewpLicenceType = app.ewp_above_11m ? 'BL' : app.ewp_below_11m ? 'SL' : '';

    return {
        position_applied_for: positions,
        position_other: app.occupation_other ?? '',
        location_preference: locations,
        location_other: locationOther,
        why_employ_response: app.why_should_we_employ_you ?? '',
        white_card_number: app.safety_induction_number ?? '',
        ewp_licence_type: ewpLicenceType,
        high_risk_licence_type: highRiskType,
        high_risk_licence_number: highRiskNumber,
        heights_training_date: '' as string,
        scaffold_licence_number: app.scaffold_licence_number ?? '',
        wit_completed: app.workplace_impairment_training ? 'yes' : '',
        wit_date: app.wit_completion_date ?? '',
        fit_test_completed: fitTest,
        asbestos_awareness: app.asbestos_awareness_training ? 'yes' : '',
        silica_awareness: app.crystalline_silica_course ? 'yes' : '',
        first_aid_date: app.first_aid_completion_date ?? '',
        workcover_claim_discussed: app.workcover_claim ? 'yes' : '',
        medical_condition_discussed: app.medical_condition && app.medical_condition !== 'none' ? 'yes' : '',
        medical_discussion_notes: app.medical_condition_other ?? '',
    };
}

function ReadOnlyView({ check, application }: { check: ExistingInterview; application: ApplicationData }) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <ReadField label="Applicant Name" value={`${application.first_name} ${application.surname}`} />
                <ReadField label="Position" value={formatOccupation(application)} />
                <ReadField
                    label="Interview Method"
                    value={INTERVIEW_METHOD_OPTIONS.find((o) => o.value === check.interview_method)?.label ?? check.interview_method}
                />
                <div className="col-span-2 grid gap-1.5 sm:col-span-3">
                    <span className="text-muted-foreground text-xs font-medium">Interviewers</span>
                    <div className="flex flex-wrap gap-1.5">
                        {check.interviewer_names && check.interviewer_names.filter(Boolean).length > 0
                            ? check.interviewer_names.filter(Boolean).map((n, i) => <Badge key={i} variant="secondary">{n}</Badge>)
                            : <span className="text-sm">—</span>}
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part B" title="Position, Skills & General" />
                <div className="grid gap-4 sm:grid-cols-3">
                    <BadgeField
                        label="Position Applied For"
                        values={(check.position_applied_for ?? []).map((v) => POSITION_OPTIONS.find((o) => o.value === v)?.label ?? v)}
                    />
                    <BadgeField label="Preferred Position" values={check.preferred_position ?? []} />
                    <BadgeField
                        label="Location"
                        values={(check.location_preference ?? []).map((v) => LOCATION_OPTIONS.find((o) => o.value === v)?.label ?? v)}
                    />
                </div>
                <div className="mt-5 grid gap-4">
                    <ReadField label="Why employ you?" value={check.why_employ_response} />
                    <ReadField label="Contract employer aware?" value={check.contract_employer_aware} />
                    <ReadField label="Perceived honesty / ethic" value={check.perceived_honesty_ethic} />
                    <ReadField label="Matches reference checks" value={
                        PERFORMANCE_OPTIONS.find((o) => o.value === check.matches_reference_checks)?.label ?? check.matches_reference_checks
                    } />
                    <ReadField label="Punctuality perception" value={check.punctuality_perception} />
                    <ReadField label="Punctuality acknowledged" value={YesNoLabel(check.punctuality_acknowledged)} />
                    <ReadField label="Family holidays" value={YesNoLabel(check.family_holidays)} />
                    {check.family_holidays === 'yes' && <ReadField label="Holiday dates" value={check.family_holidays_dates} />}
                    <ReadField label="Safe environment culture acknowledged" value={YesNoLabel(check.safe_environment_acknowledged)} />
                </div>
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part C" title="Tools & Productivity" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ReadField label="Has tools" value={YesNoLabel(check.has_tools)} />
                    <ReadField label="Tools tagged in date" value={YesNoLabel(check.tools_tagged_in_date)} />
                    <ReadField label="Tagging acknowledged" value={YesNoLabel(check.tagging_acknowledged)} />
                    <ReadField label="Productivity acknowledged" value={YesNoLabel(check.productivity_acknowledged)} />
                </div>
                {(check.tools_discussion || check.productivity_discussion) && (
                    <div className="mt-5 grid gap-4">
                        {check.tools_discussion && <ReadField label="Tools discussion" value={check.tools_discussion} />}
                        {check.productivity_discussion && <ReadField label="Productivity discussion" value={check.productivity_discussion} />}
                    </div>
                )}
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part D" title="Licences & Tickets" />
                <div className="grid gap-3">
                    <LicenceReadRow
                        title="Building Industry General Safety (white card)"
                        number={check.white_card_number}
                        date={check.white_card_date}
                        attached={check.white_card_attached}
                    />
                    <LicenceReadRow
                        title="EWP Operator Licence"
                        type={check.ewp_licence_type}
                        number={check.ewp_licence_number}
                        date={check.ewp_licence_date}
                        attached={check.ewp_licence_attached}
                    />
                    <LicenceReadRow
                        title="Licence to Perform at High Risk"
                        type={check.high_risk_licence_type}
                        number={check.high_risk_licence_number}
                        date={check.high_risk_licence_date}
                        attached={check.high_risk_licence_attached}
                    />
                    <LicenceReadRow
                        title="Work Safely at Heights"
                        date={check.heights_training_date}
                        attached={check.heights_training_attached}
                    />
                    <LicenceReadRow
                        title="Scaffold Licence"
                        number={check.scaffold_licence_number}
                        date={check.scaffold_licence_date}
                        attached={check.scaffold_licence_attached}
                    />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ReadField label="Workplace Impairment Training" value={YesNoLabel(check.wit_completed)} />
                    <ReadField label="WIT date" value={formatDate(check.wit_date)} />
                    <ReadField
                        label="Fit test"
                        value={FIT_TEST_OPTIONS.find((o) => o.value === check.fit_test_completed)?.label ?? check.fit_test_completed}
                    />
                    {check.fit_test_method && <ReadField label="Fit test method" value={check.fit_test_method} />}
                    {check.willing_to_undergo_fit_test && (
                        <ReadField label="Willing to fit test" value={YesNoLabel(check.willing_to_undergo_fit_test)} />
                    )}
                    <ReadField label="Asbestos awareness" value={YesNoLabel(check.asbestos_awareness)} />
                    <ReadField label="Silica awareness" value={YesNoLabel(check.silica_awareness)} />
                    <ReadField label="Mental health awareness" value={YesNoLabel(check.mental_health_awareness)} />
                    <ReadField label="First aid certificate" value={formatDate(check.first_aid_date)} />
                    <ReadField label="First aid refresher" value={formatDate(check.first_aid_refresher_date)} />
                </div>
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part E" title="Medical & Industrial Relations" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <ReadField label="Aware of Collective Agreement" value={YesNoLabel(check.aware_of_collective_agreement)} />
                    <ReadField label="Agree to discuss with company rep" value={YesNoLabel(check.agree_to_discuss_with_rep)} />
                    <ReadField label="WorkCover claim discussed" value={YesNoLabel(check.workcover_claim_discussed)} />
                    <ReadField label="Medical condition discussed" value={YesNoLabel(check.medical_condition_discussed)} />
                    <ReadField label="Disclosure consequences acknowledged" value={YesNoLabel(check.disclosure_consequences_acknowledged)} />
                </div>
                {check.medical_discussion_notes && (
                    <div className="mt-5">
                        <ReadField label="Medical discussion notes" value={check.medical_discussion_notes} />
                    </div>
                )}
                <div className="mt-6">
                    <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">Able to perform tasks</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {TASK_QUESTIONS.map((t) => (
                            <ReadField key={t.key} label={t.label} value={YesNoLabel(check[t.key] as string | null)} />
                        ))}
                    </div>
                </div>
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part F" title="Reference Check Review" />
                <div className="grid gap-4">
                    <ReadField label="Anything to clarify?" value={YesNoLabel(check.reference_checks_clarification)} />
                    {check.reference_checks_discussion && <ReadField label="Discussion" value={check.reference_checks_discussion} />}
                    <BadgeField
                        label="Reason for leaving previous employment"
                        values={(check.reason_for_leaving ?? []).map((r) => REASON_FOR_LEAVING_OPTIONS.find((o) => o.value === r)?.label ?? r)}
                    />
                    {check.reason_for_leaving_other && <ReadField label="Other reason" value={check.reason_for_leaving_other} />}
                </div>
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part G" title="Applicant Questions" />
                <ReadField label="Any questions from interviewee?" value={check.applicant_questions} />
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part H" title="Additional Observations" />
                <div className="grid gap-4">
                    <ReadField label="Presentation reasonable" value={check.presentation_reasonable} />
                    <ReadField label="Are they interested?" value={check.is_interested} />
                    <ReadField label="Did they review the contract?" value={check.reviewed_contract} />
                    <ReadField label="Were they organised?" value={check.was_organised} />
                    <ReadField label="Anything else?" value={check.additional_notes} />
                </div>
            </div>

            <Separator />

            <div>
                <SectionHeading part="Part I" title="Completed By" />
                <div className="grid gap-3">
                    {(check.interviewers ?? []).length === 0 ? (
                        <p className="text-muted-foreground text-sm italic">No interviewers recorded.</p>
                    ) : (
                        (check.interviewers ?? []).map((i, idx) => (
                            <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-3">
                                <ReadField label={`Interviewer ${idx + 1} — Name`} value={i.name} />
                                <ReadField label="Position" value={i.position} />
                                <ReadField label="Date" value={formatDate(i.date)} />
                            </div>
                        ))
                    )}
                </div>
                {check.completed_by_user && (
                    <p className="text-muted-foreground mt-4 text-xs">
                        Submitted by {check.completed_by_user.name} on {formatDate(check.completed_at)}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function ScreeningInterview({ application, interviewerOptions, existingInterview }: PageProps) {
    const isReadOnly = existingInterview !== null;
    const prefill = prefillFromApplication(application);
    const { auth } = usePage<SharedData>().props;
    const authUserName = auth?.user?.name ?? '';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Enquiries', href: '/employment-applications' },
        { title: `${application.first_name} ${application.surname}`, href: `/employment-applications/${application.id}` },
        { title: 'Face-to-Face Screening', href: '#' },
    ];

    const today = new Date().toISOString().substring(0, 10);

    const { data, setData, post, processing, errors } = useForm({
        interview_method: '',
        // Interviewer slots — prefill slot 1 with the auth user, slot 2 left blank for the second interviewer.
        interviewer_names: [authUserName, ''] as string[],

        position_applied_for: prefill.position_applied_for,
        position_other: prefill.position_other,
        preferred_position: [] as string[],
        location_preference: prefill.location_preference,
        location_other: prefill.location_other,
        why_employ_response: prefill.why_employ_response,
        contract_employer_aware: '',
        perceived_honesty_ethic: '',
        matches_reference_checks: '',
        punctuality_perception: '',
        punctuality_acknowledged: '',
        family_holidays: '',
        family_holidays_dates: '',
        safe_environment_acknowledged: '',

        has_tools: '',
        tools_discussion: '',
        tools_tagged_in_date: '',
        tagging_acknowledged: '',
        productivity_acknowledged: '',
        productivity_discussion: '',

        white_card_number: prefill.white_card_number,
        white_card_date: '',
        white_card_attached: false,
        ewp_licence_type: prefill.ewp_licence_type,
        ewp_licence_number: '',
        ewp_licence_date: '',
        ewp_licence_attached: false,
        high_risk_licence_type: prefill.high_risk_licence_type,
        high_risk_licence_number: prefill.high_risk_licence_number,
        high_risk_licence_date: '',
        high_risk_licence_attached: false,
        heights_training_date: '',
        heights_training_attached: false,
        scaffold_licence_number: prefill.scaffold_licence_number,
        scaffold_licence_date: '',
        scaffold_licence_attached: false,
        wit_completed: prefill.wit_completed,
        wit_date: prefill.wit_date,
        fit_test_completed: prefill.fit_test_completed,
        fit_test_method: '',
        willing_to_undergo_fit_test: '',
        asbestos_awareness: prefill.asbestos_awareness,
        silica_awareness: prefill.silica_awareness,
        mental_health_awareness: '',
        first_aid_date: prefill.first_aid_date,
        first_aid_refresher_date: '',

        aware_of_collective_agreement: '',
        agree_to_discuss_with_rep: '',
        workcover_claim_discussed: prefill.workcover_claim_discussed,
        medical_condition_discussed: prefill.medical_condition_discussed,
        medical_discussion_notes: prefill.medical_discussion_notes,
        disclosure_consequences_acknowledged: '',
        can_work_overhead: '',
        can_walk_stand: '',
        can_lift_carry: '',
        can_work_at_heights: '',
        can_operate_power_tools: '',
        can_perform_repetitive: '',
        can_operate_plant: '',

        reference_checks_clarification: '',
        reference_checks_discussion: '',
        reason_for_leaving: [] as string[],
        reason_for_leaving_other: '',

        applicant_questions: '',

        presentation_reasonable: '',
        is_interested: '',
        reviewed_contract: '',
        was_organised: '',
        additional_notes: '',

        // Two interviewer sign-off slots — names auto-bind to the picker at the top of the form.
        interviewers: [
            { name: authUserName, position: '', date: today },
            { name: '', position: '', date: today },
        ] as InterviewerEntry[],
    });

    function toggleArray(key: 'position_applied_for' | 'preferred_position' | 'location_preference' | 'reason_for_leaving', value: string) {
        const current = data[key] as string[];
        setData(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
    }

    function updateInterviewerName(index: number, value: string) {
        const nextNames = [...data.interviewer_names];
        nextNames[index] = value;
        while (nextNames.length < 2) nextNames.push('');
        // Keep Part I's interviewer name in sync with the header picker.
        const nextInterviewers = data.interviewers.map((i, idx) => (idx === index ? { ...i, name: value } : i));
        while (nextInterviewers.length < 2) {
            nextInterviewers.push({ name: '', position: '', date: today });
        }
        setData((prev) => ({
            ...prev,
            interviewer_names: nextNames.slice(0, 2),
            interviewers: nextInterviewers.slice(0, 2),
        }));
    }

    function updateInterviewer(index: number, field: keyof InterviewerEntry, value: string) {
        const next = data.interviewers.map((i, idx) => (idx === index ? { ...i, [field]: value } : i));
        setData('interviewers', next);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        post(`/employment-applications/${application.id}/screening-interview`);
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Face-to-Face Screening — ${application.first_name} ${application.surname}`} />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-3 sm:p-6">
                <div className="flex items-center justify-between">
                    <Link
                        href={`/employment-applications/${application.id}`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to enquiry
                    </Link>
                    {isReadOnly && (
                        <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Completed
                        </Badge>
                    )}
                </div>

                <div className="bg-card rounded-lg border shadow-sm">
                    <div className="border-b px-6 py-5">
                        <h1 className="text-lg font-semibold tracking-tight">Face-to-Face Screening Interview</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {application.first_name} {application.surname}
                        </p>
                    </div>

                    <div className="px-6 py-6">
                        {isReadOnly ? (
                            <ReadOnlyView check={existingInterview} application={application} />
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* Header */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="grid gap-1.5">
                                        <Label className="text-muted-foreground text-xs">Applicant Name</Label>
                                        <p className="text-sm font-medium">{application.first_name} {application.surname}</p>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-muted-foreground text-xs">Position</Label>
                                        <p className="text-sm font-medium">{formatOccupation(application)}</p>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Interview Method</Label>
                                    <OptionButtons
                                        value={data.interview_method}
                                        onChange={(v) => setData('interview_method', v)}
                                        options={INTERVIEW_METHOD_OPTIONS.map((o) => o.value)}
                                        labels={Object.fromEntries(INTERVIEW_METHOD_OPTIONS.map((o) => [o.value, o.label]))}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label>Names of interviewers <span className="text-muted-foreground font-normal">(2 required)</span></Label>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {[0, 1].map((idx) => {
                                            const selectedName = data.interviewer_names[idx] ?? '';
                                            const otherName = data.interviewer_names[idx === 0 ? 1 : 0] ?? '';
                                            return (
                                                <Select
                                                    key={idx}
                                                    value={selectedName}
                                                    onValueChange={(v) => updateInterviewerName(idx, v)}
                                                >
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder={`Interviewer ${idx + 1}`} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {interviewerOptions
                                                            .filter((u) => u.name === selectedName || u.name !== otherName)
                                                            .map((u) => (
                                                                <SelectItem key={u.id} value={u.name}>
                                                                    {u.name}
                                                                    {u.name === authUserName && (
                                                                        <span className="text-muted-foreground ml-2 text-xs">(you)</span>
                                                                    )}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            );
                                        })}
                                    </div>
                                </div>

                                <Separator />

                                {/* Part A */}
                                <div>
                                    <SectionHeading
                                        part="Part A"
                                        title="Introduction"
                                        description="Welcome the applicant, thank them for coming, and discuss the project and scope of works."
                                    />
                                </div>

                                <Separator />

                                {/* Part B */}
                                <div>
                                    <SectionHeading part="Part B" title="Position Applied For & General Information" />

                                    <div className="space-y-5">
                                        <div className="grid gap-2">
                                            <Label>Position applied for <span className="text-muted-foreground font-normal">(check from online enquiry)</span></Label>
                                            <OptionCheckboxes
                                                options={POSITION_OPTIONS}
                                                values={data.position_applied_for}
                                                onToggle={(v) => toggleArray('position_applied_for', v)}
                                                columns={2}
                                            />
                                            {data.position_applied_for.includes('other') && (
                                                <Input
                                                    placeholder="Specify (e.g. Apprentice)"
                                                    value={data.position_other}
                                                    onChange={(e) => setData('position_other', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Preferred position <span className="text-muted-foreground font-normal">(frame, sheet, set)</span></Label>
                                            <OptionCheckboxes
                                                options={PREFERRED_POSITION_OPTIONS}
                                                values={data.preferred_position}
                                                onToggle={(v) => toggleArray('preferred_position', v)}
                                                columns={4}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Location <span className="text-muted-foreground font-normal">(local, prepared to commute or relocate?)</span></Label>
                                            <OptionCheckboxes
                                                options={LOCATION_OPTIONS}
                                                values={data.location_preference}
                                                onToggle={(v) => toggleArray('location_preference', v)}
                                                columns={3}
                                            />
                                            {data.location_preference.includes('other') && (
                                                <Input
                                                    placeholder="Specify location"
                                                    value={data.location_other}
                                                    onChange={(e) => setData('location_other', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label htmlFor="why_employ_response">"Why should we employ you?" — discuss response from online enquiry</Label>
                                            <Textarea
                                                id="why_employ_response"
                                                rows={3}
                                                value={data.why_employ_response}
                                                onChange={(e) => setData('why_employ_response', e.target.value)}
                                            />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label htmlFor="contract_employer_aware">Does your contract employer know you are looking elsewhere?</Label>
                                            <Textarea
                                                id="contract_employer_aware"
                                                rows={2}
                                                value={data.contract_employer_aware}
                                                onChange={(e) => setData('contract_employer_aware', e.target.value)}
                                            />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label htmlFor="perceived_honesty_ethic">How do you think previous employers perceive your honesty &amp; work ethic?</Label>
                                            <Textarea
                                                id="perceived_honesty_ethic"
                                                rows={2}
                                                value={data.perceived_honesty_ethic}
                                                onChange={(e) => setData('perceived_honesty_ethic', e.target.value)}
                                            />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Does this match completed reference checks?</Label>
                                            <OptionButtons
                                                name="matches_ref"
                                                value={data.matches_reference_checks}
                                                onChange={(v) => setData('matches_reference_checks', v)}
                                                options={PERFORMANCE_OPTIONS.map((o) => o.value)}
                                                labels={Object.fromEntries(PERFORMANCE_OPTIONS.map((o) => [o.value, o.label]))}
                                            />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label htmlFor="punctuality_perception">How do you perceive your punctuality?</Label>
                                            <Textarea
                                                id="punctuality_perception"
                                                rows={2}
                                                value={data.punctuality_perception}
                                                onChange={(e) => setData('punctuality_perception', e.target.value)}
                                            />
                                            <p className="text-muted-foreground text-xs">Explain expectation that all employees must be punctual, fit and ready for work at all times.</p>
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Acknowledged punctuality expectations?</Label>
                                            <OptionButtons value={data.punctuality_acknowledged} onChange={(v) => setData('punctuality_acknowledged', v)} />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Any family holidays we need to know about?</Label>
                                            <OptionButtons value={data.family_holidays} onChange={(v) => setData('family_holidays', v)} />
                                            {data.family_holidays === 'yes' && (
                                                <Input
                                                    placeholder="Provide dates"
                                                    value={data.family_holidays_dates}
                                                    onChange={(e) => setData('family_holidays_dates', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Agree to embrace safe-work culture (policies, legislation, EEO)?</Label>
                                            <OptionButtons value={data.safe_environment_acknowledged} onChange={(v) => setData('safe_environment_acknowledged', v)} />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Part C */}
                                <div>
                                    <SectionHeading part="Part C" title="Tools, Equipment & Productivity" />
                                    <div className="space-y-5">
                                        <div className="grid gap-1.5">
                                            <Label>Do you have the tools and equipment to complete daily tasks?</Label>
                                            <OptionButtons value={data.has_tools} onChange={(v) => setData('has_tools', v)} options={['yes', 'no', 'unsure']} />
                                            <Textarea
                                                placeholder="Discussion: any particular tools or attachments required?"
                                                rows={2}
                                                value={data.tools_discussion}
                                                onChange={(e) => setData('tools_discussion', e.target.value)}
                                            />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Are your tools currently tagged and in date?</Label>
                                            <OptionButtons value={data.tools_tagged_in_date} onChange={(v) => setData('tools_tagged_in_date', v)} options={['yes', 'no', 'unsure']} />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Agree to test &amp; tag prior to commencement (SWC will maintain thereafter)?</Label>
                                            <OptionButtons value={data.tagging_acknowledged} onChange={(v) => setData('tagging_acknowledged', v)} />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Acknowledge continual assessment on productivity / quality (NCRs may apply)?</Label>
                                            <OptionButtons value={data.productivity_acknowledged} onChange={(v) => setData('productivity_acknowledged', v)} />
                                            <Textarea
                                                placeholder="Notes (optional)"
                                                rows={2}
                                                value={data.productivity_discussion}
                                                onChange={(e) => setData('productivity_discussion', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Part D */}
                                <div>
                                    <SectionHeading part="Part D" title="Licences & Tickets" />
                                    <div className="space-y-5">
                                        <LicenceRow
                                            title="Building Industry General Safety (white card)"
                                            number={data.white_card_number}
                                            onNumber={(v) => setData('white_card_number', v)}
                                            date={data.white_card_date}
                                            onDate={(v) => setData('white_card_date', v)}
                                            attached={data.white_card_attached}
                                            onAttached={(v) => setData('white_card_attached', v)}
                                        />

                                        <div className="grid gap-2">
                                            <Label>EWP Operator Licence</Label>
                                            <OptionButtons
                                                value={data.ewp_licence_type}
                                                onChange={(v) => setData('ewp_licence_type', v)}
                                                options={['SL', 'BL']}
                                                labels={{ SL: 'SL (below 11m)', BL: 'BL (above 11m)' }}
                                                columns={2}
                                            />
                                            <LicenceRow
                                                title=""
                                                number={data.ewp_licence_number}
                                                onNumber={(v) => setData('ewp_licence_number', v)}
                                                date={data.ewp_licence_date}
                                                onDate={(v) => setData('ewp_licence_date', v)}
                                                attached={data.ewp_licence_attached}
                                                onAttached={(v) => setData('ewp_licence_attached', v)}
                                                placeholderNumber="Licence #"
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Licence to Perform at High Risk</Label>
                                            <OptionButtons
                                                value={data.high_risk_licence_type}
                                                onChange={(v) => setData('high_risk_licence_type', v)}
                                                options={['FL', 'WP']}
                                                labels={{ FL: 'FL (Forklift)', WP: 'WP (Working Platform)' }}
                                                columns={2}
                                            />
                                            <LicenceRow
                                                title=""
                                                number={data.high_risk_licence_number}
                                                onNumber={(v) => setData('high_risk_licence_number', v)}
                                                date={data.high_risk_licence_date}
                                                onDate={(v) => setData('high_risk_licence_date', v)}
                                                attached={data.high_risk_licence_attached}
                                                onAttached={(v) => setData('high_risk_licence_attached', v)}
                                                placeholderNumber="Licence #"
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Work Safely at Heights — completion date</Label>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <DateField
                                                    value={data.heights_training_date}
                                                    onChange={(v) => setData('heights_training_date', v)}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="heights_attached"
                                                        checked={data.heights_training_attached}
                                                        onCheckedChange={(v) => setData('heights_training_attached', v === true)}
                                                    />
                                                    <Label htmlFor="heights_attached" className="font-normal">Copy attached</Label>
                                                </div>
                                            </div>
                                        </div>

                                        <LicenceRow
                                            title="Scaffold Licence"
                                            number={data.scaffold_licence_number}
                                            onNumber={(v) => setData('scaffold_licence_number', v)}
                                            date={data.scaffold_licence_date}
                                            onDate={(v) => setData('scaffold_licence_date', v)}
                                            attached={data.scaffold_licence_attached}
                                            onAttached={(v) => setData('scaffold_licence_attached', v)}
                                        />

                                        <div className="grid gap-2">
                                            <Label>Workplace Impairment Training (WIT) completed?</Label>
                                            <OptionButtons value={data.wit_completed} onChange={(v) => setData('wit_completed', v)} />
                                            {data.wit_completed === 'yes' && (
                                                <DateField value={data.wit_date} onChange={(v) => setData('wit_date', v)} />
                                            )}
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Have you completed a Fit Test? Method?</Label>
                                            <OptionButtons
                                                value={data.fit_test_completed}
                                                onChange={(v) => setData('fit_test_completed', v)}
                                                options={FIT_TEST_OPTIONS.map((o) => o.value)}
                                                labels={Object.fromEntries(FIT_TEST_OPTIONS.map((o) => [o.value, o.label]))}
                                                columns={2}
                                            />
                                            {data.fit_test_completed && data.fit_test_completed !== 'not_fitted' && data.fit_test_completed !== 'unable' && (
                                                <Input
                                                    placeholder="Method / details"
                                                    value={data.fit_test_method}
                                                    onChange={(e) => setData('fit_test_method', e.target.value)}
                                                />
                                            )}
                                            {(data.fit_test_completed === 'not_fitted' || data.fit_test_completed === 'unable') && (
                                                <div>
                                                    <Label className="text-sm">Willing to undergo a fit test?</Label>
                                                    <OptionButtons value={data.willing_to_undergo_fit_test} onChange={(v) => setData('willing_to_undergo_fit_test', v)} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Asbestos Awareness Training</Label>
                                            <OptionButtons value={data.asbestos_awareness} onChange={(v) => setData('asbestos_awareness', v)} options={['yes', 'no', 'na']} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Silica Awareness Training</Label>
                                            <OptionButtons value={data.silica_awareness} onChange={(v) => setData('silica_awareness', v)} options={['yes', 'no', 'na']} />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label>Mental Health Awareness Training</Label>
                                            <OptionButtons value={data.mental_health_awareness} onChange={(v) => setData('mental_health_awareness', v)} options={['yes', 'no', 'na']} />
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="first_aid_date">First Aid Certificate</Label>
                                                <DateField id="first_aid_date" value={data.first_aid_date} onChange={(v) => setData('first_aid_date', v)} />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label htmlFor="first_aid_refresher">First Aid Refresher</Label>
                                                <DateField id="first_aid_refresher" value={data.first_aid_refresher_date} onChange={(v) => setData('first_aid_refresher_date', v)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Part E */}
                                <div>
                                    <SectionHeading part="Part E" title="Medical History & Industrial Relations" />
                                    <div className="space-y-5">
                                        <div className="grid gap-1.5">
                                            <Label>Aware Union Collective Agreement will form part of the contract of employment?</Label>
                                            <OptionButtons value={data.aware_of_collective_agreement} onChange={(v) => setData('aware_of_collective_agreement', v)} />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Agree to discuss any discrepancies with a Company Representative (Foreman, HSR or Delegate)?</Label>
                                            <OptionButtons value={data.agree_to_discuss_with_rep} onChange={(v) => setData('agree_to_discuss_with_rep', v)} />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>WorkCover claim discussed?</Label>
                                            <OptionButtons value={data.workcover_claim_discussed} onChange={(v) => setData('workcover_claim_discussed', v)} />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>Medical / physical condition discussed?</Label>
                                            <OptionButtons value={data.medical_condition_discussed} onChange={(v) => setData('medical_condition_discussed', v)} />
                                            <Textarea
                                                placeholder="Discussion notes"
                                                rows={2}
                                                value={data.medical_discussion_notes}
                                                onChange={(e) => setData('medical_discussion_notes', e.target.value)}
                                            />
                                        </div>

                                        <div className="grid gap-1.5">
                                            <Label>
                                                Acknowledged that supplying false / misleading information voids compensation under the Workers' Compensation and Rehabilitation Act 2003?
                                            </Label>
                                            <OptionButtons value={data.disclosure_consequences_acknowledged} onChange={(v) => setData('disclosure_consequences_acknowledged', v)} />
                                        </div>

                                        <div>
                                            <p className="mb-2 text-sm">Re-confirm no condition (medical, physical or otherwise) affects the ability to perform:</p>
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {TASK_QUESTIONS.map((t) => (
                                                    <div key={t.key} className="grid gap-1.5">
                                                        <Label className="text-sm">{t.label}</Label>
                                                        <OptionButtons
                                                            name={`task_${t.key}`}
                                                            value={data[t.key as keyof typeof data] as string}
                                                            onChange={(v) => setData(t.key as keyof typeof data, v as never)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Part F */}
                                <div>
                                    <SectionHeading part="Part F" title="Review Reference Check Responses" />
                                    <div className="space-y-5">
                                        <div className="grid gap-1.5">
                                            <Label>Anything to discuss / clarify from reference checks?</Label>
                                            <OptionButtons value={data.reference_checks_clarification} onChange={(v) => setData('reference_checks_clarification', v)} />
                                            {data.reference_checks_clarification === 'yes' && (
                                                <Textarea
                                                    placeholder="Discussion"
                                                    rows={3}
                                                    value={data.reference_checks_discussion}
                                                    onChange={(e) => setData('reference_checks_discussion', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Reason for wanting to leave previous employment</Label>
                                            <OptionCheckboxes
                                                options={REASON_FOR_LEAVING_OPTIONS}
                                                values={data.reason_for_leaving}
                                                onToggle={(v) => toggleArray('reason_for_leaving', v)}
                                                columns={3}
                                            />
                                            {data.reason_for_leaving.includes('other') && (
                                                <Input
                                                    placeholder="Specify reason"
                                                    value={data.reason_for_leaving_other}
                                                    onChange={(e) => setData('reason_for_leaving_other', e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Part G */}
                                <div>
                                    <SectionHeading part="Part G" title="Applicant Questions" />
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="applicant_questions">Any questions from the interviewee?</Label>
                                        <Textarea
                                            id="applicant_questions"
                                            rows={3}
                                            value={data.applicant_questions}
                                            onChange={(e) => setData('applicant_questions', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <Separator />

                                {/* Part H */}
                                <div>
                                    <SectionHeading part="Part H" title="Additional Observations" />
                                    <div className="space-y-4">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="presentation_reasonable">Was their presentation reasonable? Describe.</Label>
                                            <Textarea
                                                id="presentation_reasonable"
                                                rows={2}
                                                value={data.presentation_reasonable}
                                                onChange={(e) => setData('presentation_reasonable', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="is_interested">Are they interested? Elaborate.</Label>
                                            <Textarea
                                                id="is_interested"
                                                rows={2}
                                                value={data.is_interested}
                                                onChange={(e) => setData('is_interested', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="reviewed_contract">Did they review the contract?</Label>
                                            <Textarea
                                                id="reviewed_contract"
                                                rows={2}
                                                value={data.reviewed_contract}
                                                onChange={(e) => setData('reviewed_contract', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="was_organised">Were they organised? Did they bring all requested information?</Label>
                                            <Textarea
                                                id="was_organised"
                                                rows={2}
                                                value={data.was_organised}
                                                onChange={(e) => setData('was_organised', e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="additional_notes">Anything else?</Label>
                                            <Textarea
                                                id="additional_notes"
                                                rows={2}
                                                value={data.additional_notes}
                                                onChange={(e) => setData('additional_notes', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Part I */}
                                <div>
                                    <SectionHeading
                                        part="Part I"
                                        title="Completed By"
                                        description="Position and sign-off date for each interviewer named at the top of this form."
                                    />
                                    <div className="space-y-3">
                                        {[0, 1].map((idx) => {
                                            const name = data.interviewer_names[idx] ?? '';
                                            const interviewer = data.interviewers[idx] ?? { name: '', position: '', date: today };
                                            return (
                                                <div key={idx} className="bg-muted/30 rounded-lg border p-3">
                                                    <div className="mb-3 flex items-center gap-2">
                                                        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                                                            Interviewer {idx + 1}
                                                        </span>
                                                        <span className="text-sm font-medium">
                                                            {name || <span className="text-muted-foreground italic">— select above</span>}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div className="grid gap-1.5">
                                                            <Label htmlFor={`pos_${idx}`} className="text-xs">Position</Label>
                                                            <Input
                                                                id={`pos_${idx}`}
                                                                placeholder="e.g. HR Manager"
                                                                value={interviewer.position}
                                                                onChange={(e) => updateInterviewer(idx, 'position', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid gap-1.5">
                                                            <Label htmlFor={`date_${idx}`} className="text-xs">Date</Label>
                                                            <DateField
                                                                id={`date_${idx}`}
                                                                value={interviewer.date}
                                                                onChange={(v) => updateInterviewer(idx, 'date', v)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {Object.keys(errors).length > 0 && (
                                    <div className="border-destructive bg-destructive/5 rounded-md border p-4 text-sm">
                                        <p className="text-destructive font-medium">Please fix the following before submitting:</p>
                                        <ul className="text-destructive mt-2 list-disc space-y-0.5 pl-5">
                                            {Object.entries(errors).map(([field, message]) => (
                                                <li key={field}>{message}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="bg-card sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-3 border-t px-6 py-4">
                                    <Link
                                        href={`/employment-applications/${application.id}`}
                                        className="text-muted-foreground hover:text-foreground text-sm"
                                    >
                                        Cancel
                                    </Link>
                                    <Button type="submit" disabled={processing} size="lg" className="h-11 px-6">
                                        {processing ? 'Saving…' : 'Submit Screening Interview'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function LicenceRow({
    title,
    number,
    onNumber,
    date,
    onDate,
    attached,
    onAttached,
    placeholderNumber = 'Licence / Induction #',
}: {
    title: string;
    number: string;
    onNumber: (v: string) => void;
    date: string;
    onDate: (v: string) => void;
    attached: boolean;
    onAttached: (v: boolean) => void;
    placeholderNumber?: string;
}) {
    const attachedId = `attached_${title || placeholderNumber}`.replace(/\s+/g, '_');
    return (
        <div className="grid gap-2">
            {title && <Label>{title}</Label>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input placeholder={placeholderNumber} value={number} onChange={(e) => onNumber(e.target.value)} className="h-11" />
                <DateField value={date} onChange={onDate} />
                <div className="flex items-center gap-2 px-1">
                    <Checkbox
                        id={attachedId}
                        checked={attached}
                        onCheckedChange={(v) => onAttached(v === true)}
                    />
                    <Label htmlFor={attachedId} className="font-normal">
                        Copy attached
                    </Label>
                </div>
            </div>
        </div>
    );
}
