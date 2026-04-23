import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    FileWarning,
    Loader2,
    Shield,
    User,
    Wrench,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';

interface Kiosk {
    id: number;
    name: string;
}

interface UserModel {
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

interface Transfer {
    id: number;
    employee_id: number;
    employee_name: string;
    employee_position: string | null;
    current_kiosk: Kiosk | null;
    proposed_kiosk: Kiosk | null;
    current_foreman: UserModel | null;
    receiving_foreman: UserModel | null;
    initiator: UserModel | null;
    safety_manager: UserModel | null;
    construction_manager: UserModel | null;
    proposed_start_date: string;
    status: string;
    transfer_reason: string;
    transfer_reason_other: string | null;
    created_at: string;

    // Part B
    overall_performance: string | null;
    work_ethic_honesty: string | null;
    quality_of_work: string | null;
    productivity_rating: string | null;
    performance_comments: string | null;

    // Part C
    punctuality: string | null;
    attendance: string | null;
    excessive_sick_leave: boolean;
    sick_leave_details: string | null;

    // Part D
    safety_attitude: string | null;
    swms_compliance: string | null;
    ppe_compliance: string | null;
    prestart_toolbox_attendance: string | null;
    has_incidents: boolean;
    incident_details: string | null;

    // Part E
    workplace_behaviour: string | null;
    attitude_towards_foreman: string | null;
    attitude_towards_coworkers: string | null;
    has_disciplinary_actions: boolean;
    disciplinary_details: string | null;
    concerns: string[] | null;
    concerns_details: string | null;

    injury_review_notes: string | null;

    // Part H
    position_applying_for: string | null;
    position_other: string | null;
    suitable_for_tasks: string | null;
    primary_skillset: string | null;
    primary_skillset_other: string | null;
    has_required_tools: boolean | null;
    tools_tagged: boolean | null;

    // Part I
    would_have_worker_again: string | null;
    rehire_conditions: string | null;
    main_strengths: string | null;
    areas_for_improvement: string | null;

    // Part J
    current_foreman_recommendation: string | null;
    current_foreman_comments: string | null;
    current_foreman_signed_at: string | null;
    safety_manager_recommendation: string | null;
    safety_manager_comments: string | null;
    safety_manager_signed_at: string | null;
    receiving_foreman_recommendation: string | null;
    receiving_foreman_comments: string | null;
    receiving_foreman_signed_at: string | null;
    construction_manager_decision: string | null;
    construction_manager_comments: string | null;
    construction_manager_signed_at: string | null;
}

interface EmployeeFileRecord {
    id: number;
    type_name: string | null;
    category: string[] | null;
    document_number: string | null;
    expires_at: string | null;
    expires_at_raw: string | null;
    completed_at: string | null;
    status: 'valid' | 'expired' | 'expiring_soon';
    notes: string | null;
}

interface PageProps {
    transfer: Transfer;
    injuries: InjuryRecord[];
    employeeFiles: EmployeeFileRecord[];
    isReceivingForeman: boolean;
    isCurrentForeman: boolean;
    authUser: { id: number; name: string };
}

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    receiving_foreman_review: 'Receiving Foreman Review',
    final_review: 'Final Review',
    approved: 'Approved',
    approved_with_conditions: 'Approved with Conditions',
    declined: 'Declined',
};

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    receiving_foreman_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    final_review: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    approved: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    approved_with_conditions: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    declined: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const REASON_LABELS: Record<string, string> = {
    project_completion: 'Project Completion',
    performance_based: 'Performance Based',
    behaviour_or_conduct: 'Behaviour or Conduct',
    injury_or_illness: 'Injury or Illness',
    productivity: 'Productivity',
    location: 'Location',
    other: 'Other',
};

const RATING_LABELS: Record<string, string> = {
    excellent: 'Excellent',
    very_good: 'Very Good',
    good: 'Good',
    average: 'Average',
    poor: 'Poor',
    high: 'High',
    acceptable: 'Acceptable',
    needs_improvement: 'Needs Improvement',
    always: 'Always',
    sometimes: 'Sometimes',
    inconsistent: 'Inconsistent',
    never: 'Never',
    proactive_positive: 'Proactive / Positive',
    professional: 'Professional',
    concerning: 'Concerning',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
};

function SectionHeader({ title, icon: Icon, description }: { title: string; icon?: React.ElementType; description?: string }) {
    return (
        <div className="mb-4 border-b border-border pb-3">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="size-4 text-muted-foreground" />}
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
    );
}

function DataRow({ label, value, variant }: { label: string; value: string | null | undefined; variant?: 'warning' | 'success' | 'danger' }) {
    if (!value) return null;
    const displayValue = RATING_LABELS[value] ?? value;
    const colorClass = variant === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : variant === 'danger'
            ? 'text-red-600 dark:text-red-400'
            : variant === 'success'
                ? 'text-green-600 dark:text-green-400'
                : 'text-foreground';

    return (
        <div className="flex items-baseline justify-between gap-4 py-1.5">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className={cn('text-sm font-medium', colorClass)}>{displayValue}</span>
        </div>
    );
}

function ratingVariant(value: string | null | undefined): 'success' | 'warning' | 'danger' | undefined {
    if (!value) return undefined;
    const negatives = ['poor', 'needs_improvement', 'inconsistent', 'never', 'concerning', 'negative'];
    const neutrals = ['average', 'sometimes', 'acceptable', 'neutral'];
    if (negatives.includes(value)) return 'danger';
    if (neutrals.includes(value)) return 'warning';
    return 'success';
}

function RatingRow({ label, value }: { label: string; value: string | null | undefined }) {
    return <DataRow label={label} value={value} variant={ratingVariant(value)} />;
}

function RecommendationBadge({ recommendation }: { recommendation: string | null }) {
    if (!recommendation) return <span className="text-xs text-muted-foreground">Pending</span>;
    const colors: Record<string, string> = {
        recommend: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
        recommend_with_conditions: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        do_not_recommend: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
        accept: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
        accept_with_conditions: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        decline: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    };
    const labels: Record<string, string> = {
        recommend: 'Recommend',
        recommend_with_conditions: 'Recommend with Conditions',
        do_not_recommend: 'Do Not Recommend',
        accept: 'Accept',
        accept_with_conditions: 'Accept with Conditions',
        decline: 'Decline',
    };
    return (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colors[recommendation] ?? '')}>
            {labels[recommendation] ?? recommendation}
        </span>
    );
}

// ── Receiving Foreman Form (Parts H & I) ──
function ReceivingForemanForm({ transfer }: { transfer: Transfer }) {
    const { data, setData, post, processing, errors } = useForm({
        position_applying_for: transfer.position_applying_for ?? '',
        position_other: transfer.position_other ?? '',
        suitable_for_tasks: transfer.suitable_for_tasks ?? '',
        primary_skillset: transfer.primary_skillset ?? '',
        primary_skillset_other: transfer.primary_skillset_other ?? '',
        has_required_tools: transfer.has_required_tools ?? false,
        tools_tagged: transfer.tools_tagged ?? false,
        would_have_worker_again: transfer.would_have_worker_again ?? '',
        rehire_conditions: transfer.rehire_conditions ?? '',
        main_strengths: transfer.main_strengths ?? '',
        areas_for_improvement: transfer.areas_for_improvement ?? '',
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        post(route('employee-transfers.receiving-review', transfer.id));
    }

    const POSITION_OPTIONS = [
        { value: 'plasterer', label: 'Plasterer' },
        { value: 'carpenter', label: 'Carpenter' },
        { value: 'labourer', label: 'Labourer' },
        { value: 'apprentice', label: 'Apprentice' },
        { value: 'other', label: 'Other' },
    ];

    const SKILLSET_OPTIONS = [
        { value: 'framing', label: 'Framing' },
        { value: 'sheeting', label: 'Sheeting' },
        { value: 'setting', label: 'Setting' },
        { value: 'carpentry', label: 'Carpentry' },
        { value: 'other', label: 'Other' },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Part H */}
            <Card className="border-amber-200 p-5 dark:border-amber-800">
                <SectionHeader title="Skills & Role Suitability" icon={Wrench} description="To be completed by receiving foreman" />
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Position Applying For</Label>
                        <div className="flex flex-wrap gap-2">
                            {POSITION_OPTIONS.map((opt) => (
                                <Label
                                    key={opt.value}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                        data.position_applying_for === opt.value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-background hover:bg-muted',
                                    )}
                                >
                                    <input type="radio" className="sr-only" checked={data.position_applying_for === opt.value} onChange={() => setData('position_applying_for', opt.value)} />
                                    {opt.label}
                                </Label>
                            ))}
                        </div>
                        <InputError message={errors.position_applying_for} />
                        {data.position_applying_for === 'other' && (
                            <input
                                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                placeholder="Specify position..."
                                value={data.position_other}
                                onChange={(e) => setData('position_other', e.target.value)}
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Is the Applicant Suitable for Required Tasks?</Label>
                        <div className="flex flex-wrap gap-2">
                            {[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'with_support', label: 'With Support' }].map((opt) => (
                                <Label
                                    key={opt.value}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                        data.suitable_for_tasks === opt.value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-background hover:bg-muted',
                                    )}
                                >
                                    <input type="radio" className="sr-only" checked={data.suitable_for_tasks === opt.value} onChange={() => setData('suitable_for_tasks', opt.value)} />
                                    {opt.label}
                                </Label>
                            ))}
                        </div>
                        <InputError message={errors.suitable_for_tasks} />
                    </div>

                    <div className="space-y-2">
                        <Label>Primary Skillset</Label>
                        <div className="flex flex-wrap gap-2">
                            {SKILLSET_OPTIONS.map((opt) => (
                                <Label
                                    key={opt.value}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                        data.primary_skillset === opt.value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-background hover:bg-muted',
                                    )}
                                >
                                    <input type="radio" className="sr-only" checked={data.primary_skillset === opt.value} onChange={() => setData('primary_skillset', opt.value)} />
                                    {opt.label}
                                </Label>
                            ))}
                        </div>
                        <InputError message={errors.primary_skillset} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-3">
                            <Checkbox id="has_required_tools" checked={data.has_required_tools} onCheckedChange={(c) => setData('has_required_tools', !!c)} />
                            <Label htmlFor="has_required_tools" className="cursor-pointer">Has Required Tools</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox id="tools_tagged" checked={data.tools_tagged} onCheckedChange={(c) => setData('tools_tagged', !!c)} />
                            <Label htmlFor="tools_tagged" className="cursor-pointer">Tools Tagged</Label>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Part I */}
            <Card className="border-amber-200 p-5 dark:border-amber-800">
                <SectionHeader title="Internal Reference Check" icon={User} description="Receiving foreman to current foreman" />
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Would you have this worker on your project again?</Label>
                        <div className="flex flex-wrap gap-2">
                            {[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'with_conditions', label: 'With Conditions' }].map((opt) => (
                                <Label
                                    key={opt.value}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                        data.would_have_worker_again === opt.value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-background hover:bg-muted',
                                    )}
                                >
                                    <input type="radio" className="sr-only" checked={data.would_have_worker_again === opt.value} onChange={() => setData('would_have_worker_again', opt.value)} />
                                    {opt.label}
                                </Label>
                            ))}
                        </div>
                        <InputError message={errors.would_have_worker_again} />
                        {data.would_have_worker_again === 'with_conditions' && (
                            <Textarea
                                value={data.rehire_conditions}
                                onChange={(e) => setData('rehire_conditions', e.target.value)}
                                placeholder="Specify conditions..."
                                rows={2}
                                className="mt-2"
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Main Strengths</Label>
                        <Textarea
                            value={data.main_strengths}
                            onChange={(e) => setData('main_strengths', e.target.value)}
                            placeholder="What are the applicant's main strengths?"
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Areas for Improvement</Label>
                        <Textarea
                            value={data.areas_for_improvement}
                            onChange={(e) => setData('areas_for_improvement', e.target.value)}
                            placeholder="What areas for improvement are recommended?"
                            rows={2}
                        />
                    </div>
                </div>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={processing}>
                    {processing && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Submit Review
                </Button>
            </div>
        </form>
    );
}

// ── Recommendation Dialog ──
function RecommendationDialog({ transfer, role, label, open, onOpenChange }: {
    transfer: Transfer;
    role: string;
    label: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const isManager = role === 'construction_manager';
    const options = isManager
        ? [
            { value: 'accept', label: 'Accept' },
            { value: 'accept_with_conditions', label: 'Accept with Conditions' },
            { value: 'decline', label: 'Decline' },
        ]
        : [
            { value: 'recommend', label: 'Recommend Transfer' },
            { value: 'recommend_with_conditions', label: 'Recommend with Conditions' },
            { value: 'do_not_recommend', label: 'Do Not Recommend' },
        ];

    const { data, setData, post, processing } = useForm({
        role,
        recommendation: '',
        comments: '',
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        post(route('employee-transfers.recommendation', transfer.id), {
            onSuccess: () => onOpenChange(false),
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{label} Recommendation</DialogTitle>
                    <DialogDescription>Submit your recommendation for this transfer request.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Decision</Label>
                        <RadioGroup value={data.recommendation} onValueChange={(v) => setData('recommendation', v)}>
                            {options.map((opt) => (
                                <div key={opt.value} className="flex items-center gap-3">
                                    <RadioGroupItem value={opt.value} id={`rec_${opt.value}`} />
                                    <Label htmlFor={`rec_${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                    <div className="space-y-2">
                        <Label>Comments</Label>
                        <Textarea
                            value={data.comments}
                            onChange={(e) => setData('comments', e.target.value)}
                            placeholder="Additional comments..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={processing || !data.recommendation}>
                            {processing && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Submit
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function Show({ transfer, injuries, employeeFiles, isReceivingForeman }: PageProps) {
    const [recDialog, setRecDialog] = useState<{ role: string; label: string } | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employee Transfers', href: '/employee-transfers' },
        { title: transfer.employee_name, href: `/employee-transfers/${transfer.id}` },
    ];

    const showReceivingForm = isReceivingForeman && (transfer.status === 'submitted' || transfer.status === 'receiving_foreman_review') && !transfer.position_applying_for;
    const isTerminal = ['approved', 'approved_with_conditions', 'declined'].includes(transfer.status);

    // Determine if there are pending recommendations the current user could action
    const hasPendingRecommendations = !isTerminal && (
        !transfer.current_foreman_recommendation ||
        !transfer.safety_manager_recommendation ||
        (!transfer.receiving_foreman_recommendation && transfer.position_applying_for) ||
        !transfer.construction_manager_decision
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Transfer - ${transfer.employee_name}`} />

            <div className="mx-auto max-w-5xl px-4 py-6 sm:w-full sm:px-6">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold text-foreground">{transfer.employee_name}</h1>
                            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[transfer.status])}>
                                {STATUS_LABELS[transfer.status]}
                            </span>
                        </div>
                        {transfer.employee_position && <p className="mt-1 text-sm text-muted-foreground">{transfer.employee_position}</p>}
                    </div>
                </div>

                {/* ── Terminal status banner at top ── */}
                {isTerminal && (
                    <div className={cn(
                        'mb-6 rounded-lg border p-4 text-center',
                        transfer.status === 'declined'
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
                    )}>
                        {transfer.status === 'declined' ? (
                            <div className="flex items-center justify-center gap-2">
                                <XCircle className="size-5" />
                                <span className="font-medium">Transfer Declined</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <CheckCircle2 className="size-5" />
                                <span className="font-medium">Transfer {transfer.status === 'approved_with_conditions' ? 'Approved with Conditions' : 'Approved'}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ACTION ZONE: Receiving Foreman Form (Parts H & I) ── */}
                {showReceivingForm && (
                    <div className="mb-6">
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                            <AlertTriangle className="size-4 shrink-0" />
                            <span><strong>Action required:</strong> Complete the skills assessment and internal reference check below.</span>
                        </div>
                        <ReceivingForemanForm transfer={transfer} />
                    </div>
                )}

                {/* ── ACTION ZONE: Part J Recommendations ── */}
                {hasPendingRecommendations && !showReceivingForm && (
                    <Card className="mb-6 p-5">
                        <SectionHeader title="Final Recommendations" description="Submit your recommendation below" />

                        <div className="space-y-3">
                            {/* Current Foreman */}
                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Current Foreman</p>
                                    <p className="text-xs text-muted-foreground">{transfer.current_foreman?.name ?? '—'}</p>
                                    {transfer.current_foreman_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.current_foreman_comments}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <RecommendationBadge recommendation={transfer.current_foreman_recommendation} />
                                    {!transfer.current_foreman_recommendation && (
                                        <Button size="sm" variant="outline" onClick={() => setRecDialog({ role: 'current_foreman', label: 'Current Foreman' })}>
                                            Submit
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Safety Manager */}
                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Safety Manager</p>
                                    <p className="text-xs text-muted-foreground">{transfer.safety_manager?.name ?? 'Not yet submitted'}</p>
                                    {transfer.safety_manager_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.safety_manager_comments}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <RecommendationBadge recommendation={transfer.safety_manager_recommendation} />
                                    {!transfer.safety_manager_recommendation && (
                                        <Button size="sm" variant="outline" onClick={() => setRecDialog({ role: 'safety_manager', label: 'Safety Manager' })}>
                                            Submit
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Receiving Foreman */}
                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Receiving Foreman</p>
                                    <p className="text-xs text-muted-foreground">{transfer.receiving_foreman?.name ?? '—'}</p>
                                    {transfer.receiving_foreman_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.receiving_foreman_comments}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <RecommendationBadge recommendation={transfer.receiving_foreman_recommendation} />
                                    {!transfer.receiving_foreman_recommendation && transfer.position_applying_for && (
                                        <Button size="sm" variant="outline" onClick={() => setRecDialog({ role: 'receiving_foreman', label: 'Receiving Foreman' })}>
                                            Submit
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Construction Manager */}
                            <div className="flex items-center justify-between rounded-md border border-border p-4 bg-muted/30">
                                <div>
                                    <p className="text-sm font-semibold">Construction Manager</p>
                                    <p className="text-xs text-muted-foreground">{transfer.construction_manager?.name ?? 'Final decision pending'}</p>
                                    {transfer.construction_manager_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.construction_manager_comments}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {transfer.construction_manager_decision ? (
                                        <RecommendationBadge recommendation={transfer.construction_manager_decision} />
                                    ) : (
                                        <>
                                            <span className="text-xs text-muted-foreground">Pending</span>
                                            <Button size="sm" onClick={() => setRecDialog({ role: 'construction_manager', label: 'Construction Manager' })}>
                                                Final Decision
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Transfer Overview */}
                <Card className="mb-6 !gap-0 !py-0 overflow-hidden">
                    {/* From → To row */}
                    <div className="flex items-stretch">
                        <div className="flex-1 p-4">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">From</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{transfer.current_kiosk?.name ?? '—'}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{transfer.current_foreman?.name ?? '—'}</p>
                        </div>
                        <div className="flex w-8 shrink-0 items-center justify-center">
                            <ArrowRight className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 p-4">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">To</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{transfer.proposed_kiosk?.name ?? '—'}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{transfer.receiving_foreman?.name ?? '—'}</p>
                        </div>
                    </div>
                    {/* Meta row */}
                    <div className="grid grid-cols-3 border-t border-border divide-x divide-border text-xs">
                        <div className="px-4 py-2.5">
                            <span className="text-muted-foreground">Start Date</span>
                            <p className="mt-0.5 font-medium text-foreground">{new Date(transfer.proposed_start_date).toLocaleDateString('en-AU')}</p>
                        </div>
                        <div className="px-4 py-2.5">
                            <span className="text-muted-foreground">Reason</span>
                            <p className="mt-0.5 font-medium text-foreground">{REASON_LABELS[transfer.transfer_reason] ?? transfer.transfer_reason}</p>
                            {transfer.transfer_reason_other && <p className="text-muted-foreground">{transfer.transfer_reason_other}</p>}
                        </div>
                        <div className="px-4 py-2.5">
                            <span className="text-muted-foreground">Initiated By</span>
                            <p className="mt-0.5 font-medium text-foreground">{transfer.initiator?.name ?? '—'} <span className="font-normal text-muted-foreground">· {new Date(transfer.created_at).toLocaleDateString('en-AU')}</span></p>
                        </div>
                    </div>
                </Card>

                {/* Current Foreman Assessment (Parts B-E) */}
                <div className="mb-6 grid gap-6 lg:grid-cols-2">
                    {/* Part B */}
                    <Card className="p-5">
                        <SectionHeader title="Performance Snapshot" />
                        <div className="divide-y divide-border">
                            <RatingRow label="Overall Performance" value={transfer.overall_performance} />
                            <RatingRow label="Work Ethic & Honesty" value={transfer.work_ethic_honesty} />
                            <RatingRow label="Quality of Work" value={transfer.quality_of_work} />
                            <RatingRow label="Productivity" value={transfer.productivity_rating} />
                        </div>
                        {transfer.performance_comments && (
                            <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.performance_comments}</p>
                        )}
                    </Card>

                    {/* Part C */}
                    <Card className="p-5">
                        <SectionHeader title="Attendance & Reliability" />
                        <div className="divide-y divide-border">
                            <RatingRow label="Punctuality" value={transfer.punctuality} />
                            <RatingRow label="Attendance" value={transfer.attendance} />
                            <DataRow label="Excessive Sick Leave" value={transfer.excessive_sick_leave ? 'Yes' : 'No'} variant={transfer.excessive_sick_leave ? 'danger' : 'success'} />
                        </div>
                        {transfer.sick_leave_details && (
                            <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.sick_leave_details}</p>
                        )}
                    </Card>

                    {/* Part D */}
                    <Card className="p-5">
                        <SectionHeader title="WHS & Site Compliance" icon={Shield} />
                        <div className="divide-y divide-border">
                            <RatingRow label="Safety Attitude" value={transfer.safety_attitude} />
                            <RatingRow label="SWMS Compliance" value={transfer.swms_compliance} />
                            <RatingRow label="PPE Compliance" value={transfer.ppe_compliance} />
                            <RatingRow label="Prestart & Toolbox" value={transfer.prestart_toolbox_attendance} />
                        </div>
                    </Card>

                    {/* Part E */}
                    <Card className="p-5">
                        <SectionHeader title="Behaviour & Conduct" />
                        <div className="divide-y divide-border">
                            <RatingRow label="Workplace Behaviour" value={transfer.workplace_behaviour} />
                            <RatingRow label="Attitude to Foreman" value={transfer.attitude_towards_foreman} />
                            <RatingRow label="Attitude to Co-Workers" value={transfer.attitude_towards_coworkers} />
                            <DataRow label="Disciplinary Actions" value={transfer.has_disciplinary_actions ? 'Yes' : 'No'} variant={transfer.has_disciplinary_actions ? 'danger' : 'success'} />
                        </div>
                        {transfer.disciplinary_details && (
                            <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.disciplinary_details}</p>
                        )}
                        {transfer.concerns && transfer.concerns.length > 0 && (
                            <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground">Concerns:</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {transfer.concerns.map((c) => (
                                        <Badge key={c} variant="outline" className="text-xs">{c === 'site_culture' ? 'Site Culture' : 'Attitude to Builder/Client'}</Badge>
                                    ))}
                                </div>
                                {transfer.concerns_details && (
                                    <p className="mt-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.concerns_details}</p>
                                )}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Parts F & G: Injury Data from System */}
                <Card className="mb-6 p-5">
                    <SectionHeader title="Injury, WorkCover & Medical Review" icon={FileWarning} description="Data from the system" />

                    {injuries.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                            <CheckCircle2 className="size-4" />
                            No injury records found for this employee.
                        </div>
                    ) : (
                        <div className="space-y-3">
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
                                        {injury.work_days_missed != null && injury.work_days_missed > 0 && <div><span className="text-muted-foreground">Days Missed:</span> {injury.work_days_missed}</div>}
                                        {injury.claim_status && <div><span className="text-muted-foreground">Claim:</span> {injury.claim_status}</div>}
                                    </div>
                                    {injury.description && (
                                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{injury.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {transfer.injury_review_notes && (
                        <div className="mt-4">
                            <p className="text-xs font-medium text-muted-foreground">Additional Notes</p>
                            <p className="mt-1 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.injury_review_notes}</p>
                        </div>
                    )}
                </Card>

                {/* Employee Files & Compliance */}
                <Card className="mb-6 p-5">
                    <SectionHeader
                        title="Employee Files & Compliance"
                        icon={Shield}
                        description="Documents on file for this employee"
                    />

                    {(() => {
                        const expiredFiles = employeeFiles.filter((f) => f.status === 'expired');
                        const expiringFiles = employeeFiles.filter((f) => f.status === 'expiring_soon');

                        return (
                            <>
                                {/* Alert banner for expired / expiring */}
                                {(expiredFiles.length > 0 || expiringFiles.length > 0) && (
                                    <div className="mb-4 space-y-2">
                                        {expiredFiles.length > 0 && (
                                            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                                                <XCircle className="size-4 shrink-0" />
                                                <span><strong>{expiredFiles.length} expired</strong> document{expiredFiles.length !== 1 ? 's' : ''}: {expiredFiles.map((f) => f.type_name).join(', ')}</span>
                                            </div>
                                        )}
                                        {expiringFiles.length > 0 && (
                                            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                <AlertTriangle className="size-4 shrink-0" />
                                                <span><strong>{expiringFiles.length} expiring soon</strong>: {expiringFiles.map((f) => `${f.type_name} (${f.expires_at})`).join(', ')}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {employeeFiles.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No files on record for this employee.</p>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {employeeFiles.map((file) => (
                                            <div key={file.id} className="flex items-center justify-between gap-4 py-2.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={cn(
                                                        'size-2 shrink-0 rounded-full',
                                                        file.status === 'expired' ? 'bg-red-500' : file.status === 'expiring_soon' ? 'bg-amber-500' : 'bg-green-500',
                                                    )} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate">{file.type_name}</p>
                                                        {file.document_number && <p className="text-xs text-muted-foreground">#{file.document_number}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {file.expires_at && (
                                                        <span className={cn(
                                                            'text-xs',
                                                            file.status === 'expired' ? 'font-medium text-red-600 dark:text-red-400'
                                                                : file.status === 'expiring_soon' ? 'font-medium text-amber-600 dark:text-amber-400'
                                                                    : 'text-muted-foreground',
                                                        )}>
                                                            {file.status === 'expired' ? 'Expired ' : file.status === 'expiring_soon' ? 'Expires ' : 'Exp '}
                                                            {file.expires_at}
                                                        </span>
                                                    )}
                                                    {!file.expires_at && (
                                                        <span className="text-xs text-muted-foreground">No expiry</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </Card>

                {/* Receiving Foreman Data (read-only, when already submitted) */}
                {!showReceivingForm && (transfer.position_applying_for || transfer.would_have_worker_again) && (
                    <div className="mb-6 grid gap-6 lg:grid-cols-2">
                        <Card className="p-5">
                            <SectionHeader title="Skills & Role Suitability" icon={Wrench} description="Receiving foreman assessment" />
                            <div className="divide-y divide-border">
                                <DataRow label="Position" value={transfer.position_applying_for === 'other' ? transfer.position_other : transfer.position_applying_for} />
                                <DataRow label="Suitable for Tasks" value={transfer.suitable_for_tasks === 'yes' ? 'Yes' : transfer.suitable_for_tasks === 'no' ? 'No' : 'With Support'} variant={transfer.suitable_for_tasks === 'yes' ? 'success' : transfer.suitable_for_tasks === 'no' ? 'danger' : 'warning'} />
                                <DataRow label="Primary Skillset" value={transfer.primary_skillset === 'other' ? transfer.primary_skillset_other : transfer.primary_skillset} />
                                <DataRow label="Has Required Tools" value={transfer.has_required_tools ? 'Yes' : 'No'} variant={transfer.has_required_tools ? 'success' : 'danger'} />
                                <DataRow label="Tools Tagged" value={transfer.tools_tagged ? 'Yes' : 'No'} variant={transfer.tools_tagged ? 'success' : 'danger'} />
                            </div>
                        </Card>

                        <Card className="p-5">
                            <SectionHeader title="Internal Reference Check" icon={User} />
                            <div className="divide-y divide-border">
                                <DataRow label="Have Worker Again" value={transfer.would_have_worker_again === 'yes' ? 'Yes' : transfer.would_have_worker_again === 'no' ? 'No' : 'With Conditions'} variant={transfer.would_have_worker_again === 'yes' ? 'success' : transfer.would_have_worker_again === 'no' ? 'danger' : 'warning'} />
                            </div>
                            {transfer.rehire_conditions && (
                                <div className="mt-3">
                                    <p className="text-xs font-medium text-muted-foreground">Conditions</p>
                                    <p className="mt-1 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.rehire_conditions}</p>
                                </div>
                            )}
                            {transfer.main_strengths && (
                                <div className="mt-3">
                                    <p className="text-xs font-medium text-muted-foreground">Strengths</p>
                                    <p className="mt-1 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.main_strengths}</p>
                                </div>
                            )}
                            {transfer.areas_for_improvement && (
                                <div className="mt-3">
                                    <p className="text-xs font-medium text-muted-foreground">Areas for Improvement</p>
                                    <p className="mt-1 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{transfer.areas_for_improvement}</p>
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {/* Part J: completed recommendations summary (only shown when terminal) */}
                {isTerminal && (
                    <Card className="mb-6 p-5">
                        <SectionHeader title="Final Recommendations" />
                        <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Current Foreman</p>
                                    <p className="text-xs text-muted-foreground">{transfer.current_foreman?.name ?? '—'}</p>
                                    {transfer.current_foreman_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.current_foreman_comments}</p>}
                                </div>
                                <RecommendationBadge recommendation={transfer.current_foreman_recommendation} />
                            </div>
                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Safety Manager</p>
                                    <p className="text-xs text-muted-foreground">{transfer.safety_manager?.name ?? '—'}</p>
                                    {transfer.safety_manager_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.safety_manager_comments}</p>}
                                </div>
                                <RecommendationBadge recommendation={transfer.safety_manager_recommendation} />
                            </div>
                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <div>
                                    <p className="text-sm font-medium">Receiving Foreman</p>
                                    <p className="text-xs text-muted-foreground">{transfer.receiving_foreman?.name ?? '—'}</p>
                                    {transfer.receiving_foreman_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.receiving_foreman_comments}</p>}
                                </div>
                                <RecommendationBadge recommendation={transfer.receiving_foreman_recommendation} />
                            </div>
                            <div className="flex items-center justify-between rounded-md border border-border p-4 bg-muted/30">
                                <div>
                                    <p className="text-sm font-semibold">Construction Manager</p>
                                    <p className="text-xs text-muted-foreground">{transfer.construction_manager?.name ?? '—'}</p>
                                    {transfer.construction_manager_comments && <p className="mt-1 text-xs text-muted-foreground">{transfer.construction_manager_comments}</p>}
                                </div>
                                <RecommendationBadge recommendation={transfer.construction_manager_decision} />
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Recommendation Dialog */}
            {recDialog && (
                <RecommendationDialog
                    transfer={transfer}
                    role={recDialog.role}
                    label={recDialog.label}
                    open={!!recDialog}
                    onOpenChange={(open) => !open && setRecDialog(null)}
                />
            )}
        </AppLayout>
    );
}
