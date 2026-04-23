import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SearchSelect } from '@/components/search-select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface KioskOption {
    id: number;
    name: string;
}

interface EmployeeOption {
    id: number;
    name: string;
    employment_type: string;
}

interface ManagerOption {
    id: number;
    name: string;
}

interface InjuryRecord {
    id: number;
    id_formal: string;
    incident: string;
    occurred_at: string | null;
    location_name: string | null;
    report_type: string | null;
    work_cover_claim: boolean;
    claim_active: boolean;
    claim_status: string | null;
    capacity: string | null;
    work_days_missed: number | null;
    description: string | null;
}

interface Props {
    kiosks: KioskOption[];
    authUser: { id: number; name: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Employee Transfers', href: '/employee-transfers' },
    { title: 'New Transfer', href: '/employee-transfers/create' },
];

const TRANSFER_REASONS = [
    { value: 'project_completion', label: 'Project Completion' },
    { value: 'performance_based', label: 'Performance Based' },
    { value: 'behaviour_or_conduct', label: 'Behaviour or Conduct' },
    { value: 'injury_or_illness', label: 'Injury or Illness' },
    { value: 'productivity', label: 'Productivity' },
    { value: 'location', label: 'Location' },
    { value: 'other', label: 'Other' },
];

function SectionHeader({ title, description }: { title: string; description?: string }) {
    return (
        <div className="mb-5 border-b border-border pb-3">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
    );
}

function RequiredLabel({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
    return (
        <Label htmlFor={htmlFor} className={className}>
            {children} <span className="text-destructive">*</span>
        </Label>
    );
}

function RatingRow({ label, options, value, onChange, error, required }: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
    required?: boolean;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <Label
                        key={opt.value}
                        className={cn(
                            'flex min-h-12 flex-1 basis-[140px] cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors active:scale-[0.99] select-none',
                            value === opt.value
                                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                                : 'border-border bg-background hover:bg-muted',
                        )}
                    >
                        <RadioGroupItem value={opt.value} className="sr-only" />
                        {opt.label}
                    </Label>
                ))}
            </RadioGroup>
            {error && <InputError message={error} />}
        </div>
    );
}

const PERFORMANCE_OPTIONS = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'very_good', label: 'Very Good' },
    { value: 'good', label: 'Good' },
    { value: 'average', label: 'Average' },
    { value: 'poor', label: 'Poor' },
];

const QUALITY_OPTIONS = [
    { value: 'high', label: 'High' },
    { value: 'acceptable', label: 'Acceptable' },
    { value: 'needs_improvement', label: 'Needs Improvement' },
];

const PUNCTUALITY_OPTIONS = [
    { value: 'always', label: 'Always' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'poor', label: 'Poor' },
];

const ATTENDANCE_OPTIONS = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'inconsistent', label: 'Inconsistent' },
    { value: 'poor', label: 'Poor' },
];

const SAFETY_ATTITUDE_OPTIONS = [
    { value: 'proactive_positive', label: 'Proactive / Positive' },
    { value: 'acceptable', label: 'Acceptable' },
    { value: 'poor', label: 'Poor (Not Acceptable)' },
];

const COMPLIANCE_OPTIONS = [
    { value: 'always', label: 'Always' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'inconsistent', label: 'Inconsistent' },
];

const PRESTART_OPTIONS = [
    { value: 'always', label: 'Always' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'never', label: 'Never' },
];

const BEHAVIOUR_OPTIONS = [
    { value: 'professional', label: 'Professional' },
    { value: 'acceptable', label: 'Acceptable' },
    { value: 'concerning', label: 'Concerning' },
];

const ATTITUDE_OPTIONS = [
    { value: 'positive', label: 'Positive' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'negative', label: 'Negative' },
];

export default function Create({ kiosks, authUser }: Props) {
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [proposedManagers, setProposedManagers] = useState<ManagerOption[]>([]);
    const [injuries, setInjuries] = useState<InjuryRecord[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);
    const [loadingManagers, setLoadingManagers] = useState(false);
    const [loadingInjuries, setLoadingInjuries] = useState(false);
    const [selectedKioskId, setSelectedKioskId] = useState<string>('');
    const [proposedKioskId, setProposedKioskId] = useState<string>('');
    const [dateOpen, setDateOpen] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        employee_id: '',
        employee_name: '',
        employee_position: '',
        current_kiosk_id: '',
        current_foreman_id: String(authUser.id),
        proposed_kiosk_id: '',
        receiving_foreman_id: '',
        proposed_start_date: '',

        // Part A
        transfer_reason: '',
        transfer_reason_other: '',

        // Part B
        overall_performance: '',
        work_ethic_honesty: '',
        quality_of_work: '',
        productivity_rating: '',
        performance_comments: '',

        // Part C
        punctuality: '',
        attendance: '',
        excessive_sick_leave: false,
        sick_leave_details: '',

        // Part D
        safety_attitude: '',
        swms_compliance: '',
        ppe_compliance: '',
        prestart_toolbox_attendance: '',

        // Part E
        workplace_behaviour: '',
        attitude_towards_foreman: '',
        attitude_towards_coworkers: '',
        has_disciplinary_actions: false,
        disciplinary_details: '',
        concerns: [] as string[],
        concerns_details: '',

        injury_review_notes: '',
    });

    // Load employees when current kiosk changes
    const loadEmployees = useCallback((kioskId: string) => {
        if (!kioskId) return;
        setLoadingEmployees(true);
        fetch(route('employee-transfers.kiosk-employees', { kiosk: kioskId }))
            .then((r) => r.json())
            .then((data) => setEmployees(data))
            .finally(() => setLoadingEmployees(false));
    }, []);

    // Load managers when proposed kiosk changes
    const loadManagers = useCallback((kioskId: string) => {
        if (!kioskId) return;
        setLoadingManagers(true);
        fetch(route('employee-transfers.kiosk-managers', { kiosk: kioskId }))
            .then((r) => r.json())
            .then((data) => setProposedManagers(data))
            .finally(() => setLoadingManagers(false));
    }, []);

    useEffect(() => {
        if (selectedKioskId) {
            loadEmployees(selectedKioskId);
            setData((prev) => ({ ...prev, current_kiosk_id: selectedKioskId, employee_id: '', employee_name: '', employee_position: '' }));
        }
    }, [selectedKioskId]);

    useEffect(() => {
        if (proposedKioskId) {
            loadManagers(proposedKioskId);
            setData((prev) => ({ ...prev, proposed_kiosk_id: proposedKioskId, receiving_foreman_id: '' }));
        }
    }, [proposedKioskId]);

    function selectEmployee(employeeId: string) {
        const emp = employees.find((e) => String(e.id) === employeeId);
        if (emp) {
            setData((prev) => ({
                ...prev,
                employee_id: String(emp.id),
                employee_name: emp.name,
                employee_position: emp.employment_type || '',
            }));

            // Fetch injury records for this employee
            setLoadingInjuries(true);
            setInjuries([]);
            fetch(route('employee-transfers.employee-injuries', { employee: emp.id }))
                .then((r) => r.json())
                .then((data) => setInjuries(data))
                .finally(() => setLoadingInjuries(false));
        }
    }

    function toggleConcern(concern: string) {
        const current = data.concerns;
        const updated = current.includes(concern) ? current.filter((c) => c !== concern) : [...current, concern];
        setData('concerns', updated);
    }

    const STEPS = [
        { key: 'details', label: 'Details' },
        { key: 'reason', label: 'Reason' },
        { key: 'performance', label: 'Performance' },
        { key: 'attendance', label: 'Attendance' },
        { key: 'whs', label: 'WHS' },
        { key: 'behaviour', label: 'Behaviour' },
        { key: 'review', label: 'Review' },
    ];
    const [step, setStep] = useState(1);
    const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

    function validateStep(n: number): Record<string, string> {
        const e: Record<string, string> = {};
        if (n === 1) {
            if (!data.current_kiosk_id) e.current_kiosk_id = 'Current project is required.';
            if (!data.employee_id) e.employee_id = 'Employee is required.';
            if (!data.proposed_kiosk_id) e.proposed_kiosk_id = 'Proposed project is required.';
            if (!data.receiving_foreman_id) e.receiving_foreman_id = 'Receiving foreman is required.';
            if (!data.proposed_start_date) e.proposed_start_date = 'Proposed start date is required.';
            if (data.proposed_kiosk_id && data.current_kiosk_id && data.proposed_kiosk_id === data.current_kiosk_id) {
                e.proposed_kiosk_id = 'Proposed project must differ from current project.';
            }
        }
        if (n === 2) {
            if (!data.transfer_reason) e.transfer_reason = 'Reason is required.';
            if (data.transfer_reason === 'other' && !data.transfer_reason_other.trim()) {
                e.transfer_reason_other = 'Please specify the reason.';
            }
        }
        if (n === 3) {
            if (!data.overall_performance) e.overall_performance = 'Required.';
            if (!data.work_ethic_honesty) e.work_ethic_honesty = 'Required.';
            if (!data.quality_of_work) e.quality_of_work = 'Required.';
            if (!data.productivity_rating) e.productivity_rating = 'Required.';
        }
        if (n === 4) {
            if (!data.punctuality) e.punctuality = 'Required.';
            if (!data.attendance) e.attendance = 'Required.';
            if (data.excessive_sick_leave && !data.sick_leave_details.trim()) {
                e.sick_leave_details = 'Please provide details.';
            }
        }
        if (n === 5) {
            if (!data.safety_attitude) e.safety_attitude = 'Required.';
            if (!data.swms_compliance) e.swms_compliance = 'Required.';
            if (!data.ppe_compliance) e.ppe_compliance = 'Required.';
            if (!data.prestart_toolbox_attendance) e.prestart_toolbox_attendance = 'Required.';
        }
        if (n === 6) {
            if (!data.workplace_behaviour) e.workplace_behaviour = 'Required.';
            if (!data.attitude_towards_foreman) e.attitude_towards_foreman = 'Required.';
            if (!data.attitude_towards_coworkers) e.attitude_towards_coworkers = 'Required.';
            if (data.has_disciplinary_actions && !data.disciplinary_details.trim()) {
                e.disciplinary_details = 'Please provide details.';
            }
            if (data.concerns.length > 0 && !data.concerns_details.trim()) {
                e.concerns_details = 'Please provide details.';
            }
        }
        return e;
    }

    function goNext() {
        const e = validateStep(step);
        setStepErrors(e);
        if (Object.keys(e).length === 0) {
            setStep((s) => Math.min(s + 1, STEPS.length));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function goBack() {
        setStep((s) => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // Run validation across all steps to guard against skipping
        const allErrors: Record<string, string> = {};
        for (let i = 1; i <= STEPS.length; i++) Object.assign(allErrors, validateStep(i));
        setStepErrors(allErrors);
        if (Object.keys(allErrors).length > 0) {
            // Jump to first step with an error
            for (let i = 1; i <= STEPS.length; i++) {
                if (Object.keys(validateStep(i)).length > 0) {
                    setStep(i);
                    break;
                }
            }
            return;
        }
        post(route('employee-transfers.store'));
    }

    const err = (key: string): string | undefined => stepErrors[key] || (errors as Record<string, string>)[key];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Employee Transfer" />

            <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
                <div className="mb-6">
                    <h1 className="text-xl font-semibold text-foreground">Internal Employee Transfer</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Screening & approval form for employees transferring between projects</p>
                </div>

                {/* Stepper progress */}
                <nav aria-label="Form steps" className="mb-6">
                    {/* Mobile: dots + current label */}
                    <div className="sm:hidden">
                        <div className="flex items-center gap-1.5">
                            {STEPS.map((s, idx) => {
                                const n = idx + 1;
                                const isActive = step === n;
                                const isDone = step > n;
                                return (
                                    <button
                                        type="button"
                                        key={s.key}
                                        aria-label={`Step ${n}: ${s.label}`}
                                        onClick={() => { if (isDone) setStep(n); }}
                                        className={cn(
                                            'h-2 flex-1 rounded-full transition-colors',
                                            isActive && 'bg-primary',
                                            isDone && !isActive && 'bg-primary/50',
                                            !isActive && !isDone && 'bg-border',
                                        )}
                                    />
                                );
                            })}
                        </div>
                        <p className="mt-2 text-sm font-medium">
                            <span className="text-muted-foreground">Step {step} of {STEPS.length} · </span>
                            {STEPS[step - 1].label}
                        </p>
                    </div>

                    {/* Tablet & desktop: full stepper */}
                    <div className="hidden sm:block">
                        <ol className="flex items-center gap-2">
                            {STEPS.map((s, idx) => {
                                const n = idx + 1;
                                const isActive = step === n;
                                const isDone = step > n;
                                return (
                                    <li key={s.key} className="flex flex-1 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { if (isDone) setStep(n); }}
                                            className={cn(
                                                'flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm transition-colors lg:px-4',
                                                isActive && 'border-primary bg-primary text-primary-foreground',
                                                isDone && !isActive && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20',
                                                !isActive && !isDone && 'border-border bg-background text-muted-foreground',
                                            )}
                                        >
                                            <span className={cn(
                                                'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                                                isActive ? 'bg-primary-foreground text-primary' : isDone ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                            )}>
                                                {isDone ? <CheckCircle2 className="size-3.5" /> : n}
                                            </span>
                                            <span className="hidden lg:inline">{s.label}</span>
                                            <span className="lg:hidden">{isActive ? s.label : ''}</span>
                                        </button>
                                        {n < STEPS.length && <div className={cn('h-px flex-1', isDone ? 'bg-primary/40' : 'bg-border')} />}
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="mt-2 text-xs text-muted-foreground">Step {step} of {STEPS.length}</p>
                    </div>
                </nav>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1 — Employee & Project Details */}
                    {step === 1 && <Card className="p-4 sm:p-5">
                        <SectionHeader title="Employee & Project Information" />

                        <div className="space-y-4">
                            {/* Current Project (Kiosk) */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <RequiredLabel>Current Project</RequiredLabel>
                                    <SearchSelect
                                        options={kiosks.map((k) => ({ value: String(k.id), label: k.name }))}
                                        optionName="project"
                                        placeholder="Select current project"
                                        selectedOption={selectedKioskId}
                                        onValueChange={setSelectedKioskId}
                                        className="h-11 text-base"
                                    />
                                    <InputError message={err('current_kiosk_id')} />
                                </div>

                                {/* Employee */}
                                <div className="space-y-2">
                                    <RequiredLabel>Employee</RequiredLabel>
                                    {loadingEmployees ? (
                                        <div className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin" /> Loading...
                                        </div>
                                    ) : (
                                        <SearchSelect
                                            options={employees.map((e) => ({ value: String(e.id), label: e.name }))}
                                            optionName="employee"
                                            placeholder={selectedKioskId ? 'Select employee' : 'Select project first'}
                                            selectedOption={data.employee_id}
                                            onValueChange={selectEmployee}
                                            disabled={!selectedKioskId}
                                            className="h-11 text-base"
                                        />
                                    )}
                                    <InputError message={err('employee_id')} />
                                </div>
                            </div>

                            {/* Employee info display */}
                            {data.employee_name && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input className="h-11 text-base" value={data.employee_name} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Position / Type</Label>
                                        <Input
                                            className="h-11 text-base"
                                            value={data.employee_position}
                                            onChange={(e) => setData('employee_position', e.target.value)}
                                            placeholder="e.g. Plasterer, Carpenter"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Current Foreman */}
                            <div className="space-y-2">
                                <Label>Current Foreman</Label>
                                <Input className="h-11 text-base" value={authUser.name} disabled />
                                <p className="text-xs text-muted-foreground">Prepopulated with your account</p>
                            </div>

                            {/* Proposed Project & Receiving Foreman */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <RequiredLabel>Proposed Project</RequiredLabel>
                                    <SearchSelect
                                        options={kiosks.map((k) => ({ value: String(k.id), label: k.name }))}
                                        optionName="project"
                                        placeholder="Select proposed project"
                                        selectedOption={proposedKioskId}
                                        onValueChange={setProposedKioskId}
                                        className="h-11 text-base"
                                    />
                                    <InputError message={err('proposed_kiosk_id')} />
                                </div>

                                <div className="space-y-2">
                                    <RequiredLabel>Receiving Foreman</RequiredLabel>
                                    {loadingManagers ? (
                                        <div className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin" /> Loading...
                                        </div>
                                    ) : (
                                        <SearchSelect
                                            options={proposedManagers.map((m) => ({ value: String(m.id), label: m.name }))}
                                            optionName="foreman"
                                            placeholder={proposedKioskId ? 'Select foreman' : 'Select project first'}
                                            selectedOption={data.receiving_foreman_id}
                                            onValueChange={(v) => setData('receiving_foreman_id', v)}
                                            disabled={!proposedKioskId}
                                            className="h-11 text-base"
                                        />
                                    )}
                                    <InputError message={err('receiving_foreman_id')} />
                                </div>
                            </div>

                            {/* Start Date */}
                            <div className="space-y-2">
                                <RequiredLabel>Proposed Start Date</RequiredLabel>
                                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                'h-12 w-full justify-start text-left text-base font-normal sm:w-[280px]',
                                                !data.proposed_start_date && 'text-muted-foreground',
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 size-4" />
                                            {data.proposed_start_date ? format(new Date(data.proposed_start_date), 'dd/MM/yyyy') : 'Select date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={data.proposed_start_date ? new Date(data.proposed_start_date) : undefined}
                                            onSelect={(date) => {
                                                setData('proposed_start_date', date ? format(date, 'yyyy-MM-dd') : '');
                                                setDateOpen(false);
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <InputError message={err('proposed_start_date')} />
                            </div>
                        </div>
                    </Card>}

                    {/* Step 2 — Reason for Transfer */}
                    {step === 2 && <Card className="p-4 sm:p-5">
                        <SectionHeader title="Reason for Transfer" />
                        <div className="space-y-4">
                            <RequiredLabel>Reason</RequiredLabel>
                            <div role="radiogroup" aria-label="Reason for transfer" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                {TRANSFER_REASONS.map((r) => {
                                    const selected = data.transfer_reason === r.value;
                                    return (
                                        <button
                                            type="button"
                                            key={r.value}
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() => setData('transfer_reason', r.value)}
                                            className={cn(
                                                'flex min-h-16 items-center justify-center rounded-md border px-3 py-3 text-center text-sm font-medium transition-colors active:scale-[0.99]',
                                                selected
                                                    ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
                                                    : 'border-border bg-background hover:bg-muted',
                                            )}
                                        >
                                            {r.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <InputError message={err('transfer_reason')} />

                            {data.transfer_reason === 'other' && (
                                <div className="space-y-2">
                                    <RequiredLabel>Please specify</RequiredLabel>
                                    <Textarea className="min-h-24 text-base"
                                        value={data.transfer_reason_other}
                                        onChange={(e) => setData('transfer_reason_other', e.target.value)}
                                        placeholder="Enter reason for transfer..."
                                        rows={2}
                                    />
                                    <InputError message={err('transfer_reason_other')} />
                                </div>
                            )}
                        </div>
                    </Card>}

                    {/* Step 3 — Internal Performance Snapshot */}
                    {step === 3 && <Card className="p-4 sm:p-5">
                        <SectionHeader title="Internal Performance Snapshot" description="Current foreman assessment" />
                        <div className="space-y-5">
                            <RatingRow required label="Overall Performance" options={PERFORMANCE_OPTIONS} value={data.overall_performance} onChange={(v) => setData('overall_performance', v)} error={err('overall_performance')} />
                            <RatingRow required label="Work Ethic & Honesty" options={PERFORMANCE_OPTIONS} value={data.work_ethic_honesty} onChange={(v) => setData('work_ethic_honesty', v)} error={err('work_ethic_honesty')} />
                            <RatingRow required label="Quality of Work" options={QUALITY_OPTIONS} value={data.quality_of_work} onChange={(v) => setData('quality_of_work', v)} error={err('quality_of_work')} />
                            <RatingRow required label="Productivity" options={QUALITY_OPTIONS} value={data.productivity_rating} onChange={(v) => setData('productivity_rating', v)} error={err('productivity_rating')} />

                            <div className="space-y-2">
                                <Label>Comments (optional)</Label>
                                <Textarea className="min-h-24 text-base"
                                    value={data.performance_comments}
                                    onChange={(e) => setData('performance_comments', e.target.value)}
                                    placeholder="Additional performance comments..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </Card>}

                    {/* Step 4 — Attendance & Reliability */}
                    {step === 4 && <Card className="p-4 sm:p-5">
                        <SectionHeader title="Attendance & Reliability" />
                        <div className="space-y-5">
                            <RatingRow required label="Punctuality / On Time" options={PUNCTUALITY_OPTIONS} value={data.punctuality} onChange={(v) => setData('punctuality', v)} error={err('punctuality')} />
                            <RatingRow required label="Attendance" options={ATTENDANCE_OPTIONS} value={data.attendance} onChange={(v) => setData('attendance', v)} error={err('attendance')} />

                            <div className="space-y-3">
                                <Label
                                    htmlFor="excessive_sick_leave"
                                    className={cn(
                                        'flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-md border px-4 py-3 transition-colors active:scale-[0.99]',
                                        data.excessive_sick_leave ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30' : 'border-border bg-background hover:bg-muted',
                                    )}
                                >
                                    <Checkbox
                                        id="excessive_sick_leave"
                                        checked={data.excessive_sick_leave}
                                        onCheckedChange={(checked) => setData('excessive_sick_leave', !!checked)}
                                        className="size-5"
                                    />
                                    <span className="text-sm font-medium">Excessive Sick Leave / Absenteeism</span>
                                </Label>
                                {data.excessive_sick_leave && (
                                    <div className="space-y-1">
                                        <Textarea className="min-h-24 text-base"
                                            value={data.sick_leave_details}
                                            onChange={(e) => setData('sick_leave_details', e.target.value)}
                                            placeholder="Provide details..."
                                            rows={2}
                                        />
                                        <InputError message={err('sick_leave_details')} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>}

                    {/* Step 5 — WHS & Site Compliance */}
                    {step === 5 && <Card className="p-4 sm:p-5">
                        <SectionHeader title="WHS & Site Compliance" />
                        <div className="space-y-5">
                            <RatingRow required label="General Compliance & Attitude Towards Safety" options={SAFETY_ATTITUDE_OPTIONS} value={data.safety_attitude} onChange={(v) => setData('safety_attitude', v)} error={err('safety_attitude')} />
                            <RatingRow required label="SWMS Compliance" options={COMPLIANCE_OPTIONS} value={data.swms_compliance} onChange={(v) => setData('swms_compliance', v)} error={err('swms_compliance')} />
                            <RatingRow required label="PPE Compliance" options={COMPLIANCE_OPTIONS} value={data.ppe_compliance} onChange={(v) => setData('ppe_compliance', v)} error={err('ppe_compliance')} />
                            <RatingRow required label="Prestart & Toolbox Attendance" options={PRESTART_OPTIONS} value={data.prestart_toolbox_attendance} onChange={(v) => setData('prestart_toolbox_attendance', v)} error={err('prestart_toolbox_attendance')} />

                            {/* Incidents / Near Misses — automated from injury register */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Incidents / Injuries or Near Misses</Label>
                                {!data.employee_id ? (
                                    <p className="text-sm text-muted-foreground">Select an employee to load injury records.</p>
                                ) : loadingInjuries ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="size-4 animate-spin" /> Loading injury records...
                                    </div>
                                ) : injuries.length === 0 ? (
                                    <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                                        <CheckCircle2 className="size-4 shrink-0" />
                                        No incidents or injuries on record.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                            <AlertTriangle className="size-3.5 shrink-0" />
                                            {injuries.length} incident{injuries.length !== 1 ? 's' : ''} found in injury register
                                        </div>
                                        {injuries.map((injury) => (
                                            <div key={injury.id} className="rounded-md border border-border p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-medium">{injury.id_formal}</p>
                                                        <p className="text-xs text-muted-foreground capitalize">{injury.incident?.replace(/_/g, ' ')}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {injury.work_cover_claim && (
                                                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">WorkCover</Badge>
                                                        )}
                                                        {injury.occurred_at && <span className="text-xs text-muted-foreground">{injury.occurred_at}</span>}
                                                    </div>
                                                </div>
                                                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                                                    {injury.location_name && <div><span className="text-muted-foreground">Site:</span> {injury.location_name}</div>}
                                                    {injury.report_type && <div><span className="text-muted-foreground">Type:</span> {injury.report_type.replace(/_/g, ' ').toUpperCase()}</div>}
                                                    {injury.capacity && <div><span className="text-muted-foreground">Capacity:</span> {injury.capacity.replace(/_/g, ' ')}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>}

                    {/* Step 6 — Behaviour & Conduct */}
                    {step === 6 && <Card className="p-4 sm:p-5">
                        <SectionHeader title="Behaviour & Conduct" />
                        <div className="space-y-5">
                            <RatingRow required label="Workplace Behaviour" options={BEHAVIOUR_OPTIONS} value={data.workplace_behaviour} onChange={(v) => setData('workplace_behaviour', v)} error={err('workplace_behaviour')} />
                            <RatingRow required label="Attitude Towards Foreman" options={ATTITUDE_OPTIONS} value={data.attitude_towards_foreman} onChange={(v) => setData('attitude_towards_foreman', v)} error={err('attitude_towards_foreman')} />
                            <RatingRow required label="Attitude Towards Co-Workers" options={ATTITUDE_OPTIONS} value={data.attitude_towards_coworkers} onChange={(v) => setData('attitude_towards_coworkers', v)} error={err('attitude_towards_coworkers')} />

                            <div className="space-y-3">
                                <Label
                                    htmlFor="has_disciplinary_actions"
                                    className={cn(
                                        'flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-md border px-4 py-3 transition-colors active:scale-[0.99]',
                                        data.has_disciplinary_actions ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30' : 'border-border bg-background hover:bg-muted',
                                    )}
                                >
                                    <Checkbox
                                        id="has_disciplinary_actions"
                                        checked={data.has_disciplinary_actions}
                                        onCheckedChange={(checked) => setData('has_disciplinary_actions', !!checked)}
                                        className="size-5"
                                    />
                                    <span className="text-sm font-medium">Any Disciplinary Actions</span>
                                </Label>
                                {data.has_disciplinary_actions && (
                                    <div className="space-y-1">
                                        <Textarea className="min-h-24 text-base"
                                            value={data.disciplinary_details}
                                            onChange={(e) => setData('disciplinary_details', e.target.value)}
                                            placeholder="Provide details of disciplinary actions..."
                                            rows={2}
                                        />
                                        <InputError message={err('disciplinary_details')} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label>Any Concerns Regarding</Label>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {[
                                        { key: 'site_culture', label: 'Site Culture' },
                                        { key: 'attitude_towards_builder_client', label: 'Attitude Towards Builder / Client' },
                                    ].map((c) => {
                                        const selected = data.concerns.includes(c.key);
                                        return (
                                            <button
                                                type="button"
                                                key={c.key}
                                                role="checkbox"
                                                aria-checked={selected}
                                                onClick={() => toggleConcern(c.key)}
                                                className={cn(
                                                    'flex min-h-12 items-center gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99]',
                                                    selected ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30' : 'border-border bg-background hover:bg-muted',
                                                )}
                                            >
                                                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded border', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                                                    {selected && <CheckCircle2 className="size-3.5" />}
                                                </span>
                                                {c.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {data.concerns.length > 0 && (
                                    <div className="space-y-1">
                                        <Textarea className="min-h-24 text-base"
                                            value={data.concerns_details}
                                            onChange={(e) => setData('concerns_details', e.target.value)}
                                            placeholder="Provide details..."
                                            rows={2}
                                        />
                                        <InputError message={err('concerns_details')} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>}

                    {/* Step 7 — Review & Submit */}
                    {step === 7 && (
                        <div className="space-y-6">
                            <Card className="p-4 sm:p-5">
                                <SectionHeader title="Injury & Medical Notes" description="Any existing injury or WorkCover data will be shown from the system on the review page. Add any additional notes below." />
                                <Textarea className="min-h-24 text-base"
                                    value={data.injury_review_notes}
                                    onChange={(e) => setData('injury_review_notes', e.target.value)}
                                    placeholder="Additional notes regarding injury history, WorkCover, or medical considerations..."
                                    rows={3}
                                />
                            </Card>

                            <Card className="p-4 sm:p-5">
                                <SectionHeader title="Review" description="Confirm details before submitting." />
                                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                    <div><dt className="text-muted-foreground">Employee</dt><dd className="font-medium">{data.employee_name || '—'}</dd></div>
                                    <div><dt className="text-muted-foreground">Position</dt><dd className="font-medium">{data.employee_position || '—'}</dd></div>
                                    <div><dt className="text-muted-foreground">Current Project</dt><dd className="font-medium">{kiosks.find((k) => String(k.id) === data.current_kiosk_id)?.name || '—'}</dd></div>
                                    <div><dt className="text-muted-foreground">Proposed Project</dt><dd className="font-medium">{kiosks.find((k) => String(k.id) === data.proposed_kiosk_id)?.name || '—'}</dd></div>
                                    <div><dt className="text-muted-foreground">Receiving Foreman</dt><dd className="font-medium">{proposedManagers.find((m) => String(m.id) === data.receiving_foreman_id)?.name || '—'}</dd></div>
                                    <div><dt className="text-muted-foreground">Start Date</dt><dd className="font-medium">{data.proposed_start_date ? format(new Date(data.proposed_start_date), 'dd/MM/yyyy') : '—'}</dd></div>
                                    <div className="sm:col-span-2"><dt className="text-muted-foreground">Reason</dt><dd className="font-medium">{TRANSFER_REASONS.find((r) => r.value === data.transfer_reason)?.label || '—'}{data.transfer_reason === 'other' && data.transfer_reason_other ? ` — ${data.transfer_reason_other}` : ''}</dd></div>
                                </dl>
                            </Card>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="sticky bottom-0 -mx-3 flex items-center justify-between gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
                        <Button
                            type="button"
                            variant="ghost"
                            size="lg"
                            className={cn('h-12', step > 1 && 'hidden sm:inline-flex')}
                            onClick={() => router.visit(route('employee-transfers.index'))}
                        >
                            Cancel
                        </Button>
                        <div className="flex items-center gap-2">
                            {step > 1 && (
                                <Button type="button" variant="outline" size="lg" className="h-12 px-5" onClick={goBack}>
                                    <ChevronLeft className="mr-1 size-5" /> Back
                                </Button>
                            )}
                            {step < STEPS.length ? (
                                <Button type="button" size="lg" className="h-12 px-6 text-base" onClick={goNext}>
                                    Next <ChevronRight className="ml-1 size-5" />
                                </Button>
                            ) : (
                                <Button type="submit" size="lg" className="h-12 px-6 text-base" disabled={processing}>
                                    {processing && <Loader2 className="mr-2 size-4 animate-spin" />}
                                    Submit
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
