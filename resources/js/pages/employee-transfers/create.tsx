import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarIcon, CheckCircle2, Loader2 } from 'lucide-react';
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

function RatingRow({ label, options, value, onChange, error }: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">{label}</Label>
            <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <Label
                        key={opt.value}
                        className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                            value === opt.value
                                ? 'border-primary bg-primary/5 text-primary'
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

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        post(route('employee-transfers.store'));
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Employee Transfer" />

            <div className="mx-auto max-w-5xl px-4 py-6 sm:w-full sm:px-6">
                <div className="mb-6">
                    <h1 className="text-xl font-semibold text-foreground">Internal Employee Transfer</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Screening & approval form for employees transferring between projects</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ── Header: Employee & Project Details ── */}
                    <Card className="p-5">
                        <SectionHeader part="Transfer Details" title="Employee & Project Information" />

                        <div className="space-y-4">
                            {/* Current Project (Kiosk) */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Current Project</Label>
                                    <Select value={selectedKioskId} onValueChange={setSelectedKioskId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select current project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {kiosks.map((k) => (
                                                <SelectItem key={k.id} value={String(k.id)}>
                                                    {k.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.current_kiosk_id} />
                                </div>

                                {/* Employee */}
                                <div className="space-y-2">
                                    <Label>Employee</Label>
                                    {loadingEmployees ? (
                                        <div className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin" /> Loading...
                                        </div>
                                    ) : (
                                        <Select
                                            value={data.employee_id}
                                            onValueChange={selectEmployee}
                                            disabled={!selectedKioskId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={selectedKioskId ? 'Select employee' : 'Select project first'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map((e) => (
                                                    <SelectItem key={e.id} value={String(e.id)}>
                                                        {e.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <InputError message={errors.employee_id} />
                                </div>
                            </div>

                            {/* Employee info display */}
                            {data.employee_name && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input value={data.employee_name} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Position / Type</Label>
                                        <Input
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
                                <Input value={authUser.name} disabled />
                                <p className="text-xs text-muted-foreground">Prepopulated with your account</p>
                            </div>

                            {/* Proposed Project & Receiving Foreman */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Proposed Project</Label>
                                    <Select value={proposedKioskId} onValueChange={setProposedKioskId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select proposed project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {kiosks.map((k) => (
                                                <SelectItem key={k.id} value={String(k.id)}>
                                                    {k.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.proposed_kiosk_id} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Receiving Foreman</Label>
                                    {loadingManagers ? (
                                        <div className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
                                            <Loader2 className="size-4 animate-spin" /> Loading...
                                        </div>
                                    ) : (
                                        <Select
                                            value={data.receiving_foreman_id}
                                            onValueChange={(v) => setData('receiving_foreman_id', v)}
                                            disabled={!proposedKioskId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={proposedKioskId ? 'Select foreman' : 'Select project first'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {proposedManagers.map((m) => (
                                                    <SelectItem key={m.id} value={String(m.id)}>
                                                        {m.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <InputError message={errors.receiving_foreman_id} />
                                </div>
                            </div>

                            {/* Start Date */}
                            <div className="space-y-2">
                                <Label>Proposed Start Date</Label>
                                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                'w-full justify-start text-left font-normal sm:w-[260px]',
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
                                <InputError message={errors.proposed_start_date} />
                            </div>
                        </div>
                    </Card>

                    {/* ── Part A: Reason for Transfer ── */}
                    <Card className="p-5">
                        <SectionHeader title="Reason for Transfer" />
                        <div className="space-y-4">
                            <Select value={data.transfer_reason} onValueChange={(v) => setData('transfer_reason', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select reason for transfer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRANSFER_REASONS.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.transfer_reason} />

                            {data.transfer_reason === 'other' && (
                                <div className="space-y-2">
                                    <Label>Please specify</Label>
                                    <Textarea
                                        value={data.transfer_reason_other}
                                        onChange={(e) => setData('transfer_reason_other', e.target.value)}
                                        placeholder="Enter reason for transfer..."
                                        rows={2}
                                    />
                                    <InputError message={errors.transfer_reason_other} />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* ── Part B: Internal Performance Snapshot ── */}
                    <Card className="p-5">
                        <SectionHeader title="Internal Performance Snapshot" description="Current foreman assessment" />
                        <div className="space-y-5">
                            <RatingRow label="Overall Performance" name="overall_performance" options={PERFORMANCE_OPTIONS} value={data.overall_performance} onChange={(v) => setData('overall_performance', v)} error={errors.overall_performance} />
                            <RatingRow label="Work Ethic & Honesty" name="work_ethic_honesty" options={PERFORMANCE_OPTIONS} value={data.work_ethic_honesty} onChange={(v) => setData('work_ethic_honesty', v)} error={errors.work_ethic_honesty} />
                            <RatingRow label="Quality of Work" name="quality_of_work" options={QUALITY_OPTIONS} value={data.quality_of_work} onChange={(v) => setData('quality_of_work', v)} error={errors.quality_of_work} />
                            <RatingRow label="Productivity" name="productivity_rating" options={QUALITY_OPTIONS} value={data.productivity_rating} onChange={(v) => setData('productivity_rating', v)} error={errors.productivity_rating} />

                            <div className="space-y-2">
                                <Label>Comments (optional)</Label>
                                <Textarea
                                    value={data.performance_comments}
                                    onChange={(e) => setData('performance_comments', e.target.value)}
                                    placeholder="Additional performance comments..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* ── Part C: Attendance & Reliability ── */}
                    <Card className="p-5">
                        <SectionHeader title="Attendance & Reliability" />
                        <div className="space-y-5">
                            <RatingRow label="Punctuality / On Time" name="punctuality" options={PUNCTUALITY_OPTIONS} value={data.punctuality} onChange={(v) => setData('punctuality', v)} error={errors.punctuality} />
                            <RatingRow label="Attendance" name="attendance" options={ATTENDANCE_OPTIONS} value={data.attendance} onChange={(v) => setData('attendance', v)} error={errors.attendance} />

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        id="excessive_sick_leave"
                                        checked={data.excessive_sick_leave}
                                        onCheckedChange={(checked) => setData('excessive_sick_leave', !!checked)}
                                    />
                                    <Label htmlFor="excessive_sick_leave" className="cursor-pointer">Excessive Sick Leave / Absenteeism</Label>
                                </div>
                                {data.excessive_sick_leave && (
                                    <Textarea
                                        value={data.sick_leave_details}
                                        onChange={(e) => setData('sick_leave_details', e.target.value)}
                                        placeholder="Provide details..."
                                        rows={2}
                                    />
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ── Part D: WHS & Site Compliance ── */}
                    <Card className="p-5">
                        <SectionHeader title="WHS & Site Compliance" />
                        <div className="space-y-5">
                            <RatingRow label="General Compliance & Attitude Towards Safety" name="safety_attitude" options={SAFETY_ATTITUDE_OPTIONS} value={data.safety_attitude} onChange={(v) => setData('safety_attitude', v)} error={errors.safety_attitude} />
                            <RatingRow label="SWMS Compliance" name="swms_compliance" options={COMPLIANCE_OPTIONS} value={data.swms_compliance} onChange={(v) => setData('swms_compliance', v)} error={errors.swms_compliance} />
                            <RatingRow label="PPE Compliance" name="ppe_compliance" options={COMPLIANCE_OPTIONS} value={data.ppe_compliance} onChange={(v) => setData('ppe_compliance', v)} error={errors.ppe_compliance} />
                            <RatingRow label="Prestart & Toolbox Attendance" name="prestart_toolbox_attendance" options={PRESTART_OPTIONS} value={data.prestart_toolbox_attendance} onChange={(v) => setData('prestart_toolbox_attendance', v)} error={errors.prestart_toolbox_attendance} />

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
                    </Card>

                    {/* ── Part E: Behaviour & Conduct ── */}
                    <Card className="p-5">
                        <SectionHeader title="Behaviour & Conduct" />
                        <div className="space-y-5">
                            <RatingRow label="Workplace Behaviour" name="workplace_behaviour" options={BEHAVIOUR_OPTIONS} value={data.workplace_behaviour} onChange={(v) => setData('workplace_behaviour', v)} error={errors.workplace_behaviour} />
                            <RatingRow label="Attitude Towards Foreman" name="attitude_towards_foreman" options={ATTITUDE_OPTIONS} value={data.attitude_towards_foreman} onChange={(v) => setData('attitude_towards_foreman', v)} error={errors.attitude_towards_foreman} />
                            <RatingRow label="Attitude Towards Co-Workers" name="attitude_towards_coworkers" options={ATTITUDE_OPTIONS} value={data.attitude_towards_coworkers} onChange={(v) => setData('attitude_towards_coworkers', v)} error={errors.attitude_towards_coworkers} />

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        id="has_disciplinary_actions"
                                        checked={data.has_disciplinary_actions}
                                        onCheckedChange={(checked) => setData('has_disciplinary_actions', !!checked)}
                                    />
                                    <Label htmlFor="has_disciplinary_actions" className="cursor-pointer">Any Disciplinary Actions</Label>
                                </div>
                                {data.has_disciplinary_actions && (
                                    <Textarea
                                        value={data.disciplinary_details}
                                        onChange={(e) => setData('disciplinary_details', e.target.value)}
                                        placeholder="Provide details of disciplinary actions..."
                                        rows={2}
                                    />
                                )}
                            </div>

                            <div className="space-y-3">
                                <Label>Any Concerns Regarding</Label>
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="concern_site_culture"
                                            checked={data.concerns.includes('site_culture')}
                                            onCheckedChange={() => toggleConcern('site_culture')}
                                        />
                                        <Label htmlFor="concern_site_culture" className="cursor-pointer text-sm">Site Culture</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="concern_attitude_builder"
                                            checked={data.concerns.includes('attitude_towards_builder_client')}
                                            onCheckedChange={() => toggleConcern('attitude_towards_builder_client')}
                                        />
                                        <Label htmlFor="concern_attitude_builder" className="cursor-pointer text-sm">Attitude Towards Builder / Client</Label>
                                    </div>
                                </div>
                                {data.concerns.length > 0 && (
                                    <Textarea
                                        value={data.concerns_details}
                                        onChange={(e) => setData('concerns_details', e.target.value)}
                                        placeholder="Provide details..."
                                        rows={2}
                                    />
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ── Notes (for injury/medical context) ── */}
                    <Card className="p-5">
                        <SectionHeader title="Injury & Medical Notes" description="Any existing injury or WorkCover data will be shown from the system on the review page. Add any additional notes below." />
                        <Textarea
                            value={data.injury_review_notes}
                            onChange={(e) => setData('injury_review_notes', e.target.value)}
                            placeholder="Additional notes regarding injury history, WorkCover, or medical considerations..."
                            rows={3}
                        />
                    </Card>

                    {/* Submit */}
                    <div className="flex items-center justify-end gap-3 pb-8">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.visit(route('employee-transfers.index'))}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Submit Transfer Request
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
