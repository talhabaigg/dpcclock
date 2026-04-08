import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ClipboardCopy, Download, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ActionPoint { action: string; by_who: string; by_when: string }
interface Apprentice { name: string; project: string; year_level: string; completion_date: string; comments: string }
interface CsqPayment { reference: string; date: string; description: string; total: number }
interface ClaimOverview { entity: string; total_lodged: number; active_statutory: number; active_common_law: number; denied: number; comments: string }

interface WhsReport {
    id: number;
    year: number;
    month: number;
    key_issues: string | null;
    action_points: ActionPoint[] | null;
    apprentices: Apprentice[] | null;
    csq_payments: CsqPayment[] | null;
    training_summary: string | null;
    bottom_action_points: ActionPoint[] | null;
    claims_overview: ClaimOverview[] | null;
}

interface SimpleUser {
    id: number;
    name: string;
}

interface Props {
    report: WhsReport;
    previousReport: WhsReport | null;
    year: number;
    month: number;
    users: SimpleUser[];
}

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]?.toUpperCase()).filter(Boolean).join('');
}

function MultiUserSelect({ value, users, onChange }: { value: string; users: SimpleUser[]; onChange: (v: string) => void }) {
    const selected = value ? value.split(', ').filter(Boolean) : [];

    const toggle = (initials: string) => {
        const next = selected.includes(initials)
            ? selected.filter(s => s !== initials)
            : [...selected, initials];
        onChange(next.join(', '));
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" type="button" className="w-44 justify-start font-normal truncate">
                    {selected.length > 0 ? selected.join(', ') : <span className="text-muted-foreground">By who</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
                <div className="max-h-48 overflow-y-auto space-y-1">
                    {users.map(u => {
                        const initials = getInitials(u.name);
                        return (
                            <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                                <Checkbox checked={selected.includes(initials)} onCheckedChange={() => toggle(initials)} />
                                <span>{u.name}</span>
                                <span className="ml-auto text-xs text-muted-foreground">{initials}</span>
                            </label>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
const byWhenYears = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + i - 1));

function ActionPointsSection({ items, users, onUpdate, onAdd, onRemove }: {
    items: ActionPoint[];
    users: SimpleUser[];
    onUpdate: (index: number, field: keyof ActionPoint, value: string) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
}) {
    const parseByWhen = (val: string) => {
        const parts = val.split(' ');
        return { month: parts[0] ?? '', year: parts[1] ?? '' };
    };
    const setByWhen = (index: number, month: string, year: string) => {
        onUpdate(index, 'by_when', month && year ? `${month} ${year}` : month || year);
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={onAdd}>
                    <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
            </div>
            {items.map((ap, i) => {
                const bw = parseByWhen(ap.by_when);
                return (
                    <div key={i} className="flex gap-2 items-start">
                        <Input className="flex-1" placeholder="Action..." value={ap.action} onChange={e => onUpdate(i, 'action', e.target.value)} />
                        <MultiUserSelect value={ap.by_who} users={users} onChange={v => onUpdate(i, 'by_who', v)} />
                        <Select value={bw.month || undefined} onValueChange={v => setByWhen(i, v, bw.year)}>
                            <SelectTrigger className="w-24">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {shortMonths.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={bw.year || undefined} onValueChange={v => setByWhen(i, bw.month, v)}>
                            <SelectTrigger className="w-24">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {byWhenYears.map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                );
            })}
        </div>
    );
}

export default function WhsReportEdit({ report, previousReport, year, month, users }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props as { flash: { success?: string; error?: string } };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Reports', href: '/' },
        { title: 'Safety Dashboard', href: '/reports/safety-dashboard' },
        { title: `WHS Report - ${months[month - 1]} ${year}`, href: '#' },
    ];

    const [saving, setSaving] = useState(false);
    const [keyIssues, setKeyIssues] = useState(report.key_issues ?? '');
    const [actionPoints, setActionPoints] = useState<ActionPoint[]>(report.action_points ?? []);
    const [apprentices, setApprentices] = useState<Apprentice[]>(report.apprentices ?? []);
    const [csqPayments, setCsqPayments] = useState<CsqPayment[]>(report.csq_payments ?? []);
    const [trainingSummary, setTrainingSummary] = useState(report.training_summary ?? '');
    const [bottomActionPoints, setBottomActionPoints] = useState<ActionPoint[]>(report.bottom_action_points ?? []);
    const [claimsOverview, setClaimsOverview] = useState<ClaimOverview[]>(
        report.claims_overview ?? [
            { entity: 'GrLine', total_lodged: 0, active_statutory: 0, active_common_law: 0, denied: 0, comments: '' },
            { entity: 'SWCPE', total_lodged: 0, active_statutory: 0, active_common_law: 0, denied: 0, comments: '' },
        ]
    );

    const copyFromPrevious = () => {
        if (!previousReport) return;
        if (!confirm('This will overwrite all current form data with last month\'s report. Continue?')) return;
        setKeyIssues(previousReport.key_issues ?? '');
        setActionPoints(previousReport.action_points ?? []);
        setApprentices(previousReport.apprentices ?? []);
        setCsqPayments(previousReport.csq_payments ?? []);
        setTrainingSummary(previousReport.training_summary ?? '');
        setBottomActionPoints(previousReport.bottom_action_points ?? []);
        setClaimsOverview(previousReport.claims_overview ?? [
            { entity: 'GrLine', total_lodged: 0, active_statutory: 0, active_common_law: 0, denied: 0, comments: '' },
            { entity: 'SWCPE', total_lodged: 0, active_statutory: 0, active_common_law: 0, denied: 0, comments: '' },
        ]);
    };

    const handleSave = () => {
        setSaving(true);
        router.put(`/reports/whs-report/${report.id}`, {
            key_issues: keyIssues,
            action_points: actionPoints,
            apprentices,
            csq_payments: csqPayments,
            training_summary: trainingSummary,
            bottom_action_points: bottomActionPoints,
            claims_overview: claimsOverview,
        }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        });
    };

    // Generic array helpers
    const updateItem = <T,>(arr: T[], index: number, field: keyof T, value: T[keyof T], setter: (v: T[]) => void) => {
        const copy = [...arr];
        copy[index] = { ...copy[index], [field]: value };
        setter(copy);
    };
    const addItem = <T,>(arr: T[], item: T, setter: (v: T[]) => void) => setter([...arr, item]);
    const removeItem = <T,>(arr: T[], index: number, setter: (v: T[]) => void) => setter(arr.filter((_, i) => i !== index));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`WHS Report - ${months[month - 1]} ${year}`} />

            <div className="mx-auto max-w-5xl space-y-4 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}
                {flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">WHS Monthly Report: {months[month - 1]} {year}</h1>
                    <div className="flex gap-2">
                        {previousReport && (
                            <Button variant="outline" onClick={copyFromPrevious}>
                                <ClipboardCopy className="mr-1 h-4 w-4" />
                                Copy from {months[(month === 1 ? 11 : month - 2)]}
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <a href={`/reports/whs-report/pdf?year=${year}&month=${month}`}>
                                <Download className="mr-1 h-4 w-4" /> Download PDF
                            </a>
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>

                {/* Claims Overview */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Claims Overview</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {claimsOverview.map((co, i) => (
                                <div key={i} className="grid grid-cols-6 gap-2 items-end">
                                    <div>
                                        <Label className="text-xs">Entity</Label>
                                        <Input value={co.entity} onChange={e => updateItem(claimsOverview, i, 'entity', e.target.value, setClaimsOverview)} />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Claims Lodged</Label>
                                        <Input type="number" value={co.total_lodged} onChange={e => updateItem(claimsOverview, i, 'total_lodged', Number(e.target.value), setClaimsOverview)} />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Active Statutory</Label>
                                        <Input type="number" value={co.active_statutory} onChange={e => updateItem(claimsOverview, i, 'active_statutory', Number(e.target.value), setClaimsOverview)} />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Active Common Law</Label>
                                        <Input type="number" value={co.active_common_law} onChange={e => updateItem(claimsOverview, i, 'active_common_law', Number(e.target.value), setClaimsOverview)} />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Denied</Label>
                                        <Input type="number" value={co.denied} onChange={e => updateItem(claimsOverview, i, 'denied', Number(e.target.value), setClaimsOverview)} />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Comments</Label>
                                        <Input value={co.comments} onChange={e => updateItem(claimsOverview, i, 'comments', e.target.value, setClaimsOverview)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Key Issues */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Key Issues Identified</CardTitle></CardHeader>
                    <CardContent>
                        <Textarea rows={5} value={keyIssues} onChange={e => setKeyIssues(e.target.value)} placeholder="Describe key WHS issues for this month..." />
                    </CardContent>
                </Card>

                {/* Proposed Action Points */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Proposed Action Points</CardTitle></CardHeader>
                    <CardContent>
                        <ActionPointsSection
                            items={actionPoints}
                            users={users}
                            onUpdate={(i, field, value) => updateItem(actionPoints, i, field, value, setActionPoints)}
                            onAdd={() => addItem(actionPoints, { action: '', by_who: '', by_when: '' }, setActionPoints)}
                            onRemove={(i) => removeItem(actionPoints, i, setActionPoints)}
                        />
                    </CardContent>
                </Card>

                {/* Apprentice Overview */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Apprentice Overview</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => addItem(apprentices, { name: '', project: '', year_level: '', completion_date: '', comments: '' }, setApprentices)}>
                                    <Plus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                            {apprentices.map((app, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <Input className="flex-1" placeholder="Name" value={app.name} onChange={e => updateItem(apprentices, i, 'name', e.target.value, setApprentices)} />
                                    <Input className="w-28" placeholder="Project" value={app.project} onChange={e => updateItem(apprentices, i, 'project', e.target.value, setApprentices)} />
                                    <Input className="w-20" placeholder="Year" value={app.year_level} onChange={e => updateItem(apprentices, i, 'year_level', e.target.value, setApprentices)} />
                                    <Input className="w-28" placeholder="Completion" value={app.completion_date} onChange={e => updateItem(apprentices, i, 'completion_date', e.target.value, setApprentices)} />
                                    <Input className="flex-1" placeholder="Comments" value={app.comments} onChange={e => updateItem(apprentices, i, 'comments', e.target.value, setApprentices)} />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(apprentices, i, setApprentices)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* CSQ Payments */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">CSQ Payments Received</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="flex justify-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => addItem(csqPayments, { reference: '', date: '', description: '', total: 0 }, setCsqPayments)}>
                                    <Plus className="mr-1 h-3 w-3" /> Add
                                </Button>
                            </div>
                            {csqPayments.map((pay, i) => (
                                <div key={i} className="flex gap-2 items-start">
                                    <Input className="w-28" placeholder="Reference" value={pay.reference} onChange={e => updateItem(csqPayments, i, 'reference', e.target.value, setCsqPayments)} />
                                    <Input className="w-28" placeholder="Date" value={pay.date} onChange={e => updateItem(csqPayments, i, 'date', e.target.value, setCsqPayments)} />
                                    <Input className="flex-1" placeholder="Description" value={pay.description} onChange={e => updateItem(csqPayments, i, 'description', e.target.value, setCsqPayments)} />
                                    <Input className="w-32" type="number" placeholder="Total" value={pay.total} onChange={e => updateItem(csqPayments, i, 'total', Number(e.target.value), setCsqPayments)} />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(csqPayments, i, setCsqPayments)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Training Summary */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Training Summary</CardTitle></CardHeader>
                    <CardContent>
                        <Textarea rows={4} value={trainingSummary} onChange={e => setTrainingSummary(e.target.value)} placeholder="Training activities this month (one per line)..." />
                    </CardContent>
                </Card>

                {/* Bottom Action Points */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Action Points</CardTitle></CardHeader>
                    <CardContent>
                        <ActionPointsSection
                            items={bottomActionPoints}
                            users={users}
                            onUpdate={(i, field, value) => updateItem(bottomActionPoints, i, field, value, setBottomActionPoints)}
                            onAdd={() => addItem(bottomActionPoints, { action: '', by_who: '', by_when: '' }, setBottomActionPoints)}
                            onRemove={(i) => removeItem(bottomActionPoints, i, setBottomActionPoints)}
                        />
                    </CardContent>
                </Card>

                {/* Bottom save */}
                <div className="flex justify-end gap-2 pb-8">
                    <Button variant="outline" asChild>
                        <a href={`/reports/whs-report/pdf?year=${year}&month=${month}`}>
                            <Download className="mr-1 h-4 w-4" /> Download PDF
                        </a>
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
