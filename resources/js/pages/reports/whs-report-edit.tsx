import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RichTextEditor from '@/components/ui/rich-text-editor';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, ClipboardCopy, FileText, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ActionPoint { action: string; by_who: string; by_when: string }
interface Apprentice { name: string; project: string; year_level: string; completion_date: string; comments: string }
interface CsqPayment { reference: string; date: string; description: string; total: number }
interface ClaimOverview { entity: string; total_lodged: number; active_statutory: number; active_common_law: number; denied: number }

interface WhsReport {
    id: number;
    year: number;
    month: number;
    key_issues: string | null;
    action_points: ActionPoint[] | null;
    apprentices: Apprentice[] | null;
    training_summary: string | null;
    bottom_action_points: ActionPoint[] | null;
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
    claimsOverview: ClaimOverview[];
    fyStartYear: number;
    trainingCost: number;
    csqGlPayments: CsqPayment[];
}

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]?.toUpperCase()).filter(Boolean).join('');
}

function MultiUserSelect({ value, users, onChange }: { value: string; users: SimpleUser[]; onChange: (v: string) => void }) {
    const [search, setSearch] = useState('');
    const selected = useMemo(() => value ? value.split('|').filter(Boolean) : [], [value]);

    const toggle = (name: string) => {
        const next = selected.includes(name)
            ? selected.filter(s => s !== name)
            : [...selected, name];
        onChange(next.join('|'));
    };

    const filtered = useMemo(() => {
        if (!search) return users;
        const q = search.toLowerCase();
        return users.filter(u => u.name.toLowerCase().includes(q));
    }, [users, search]);

    const selectedUsers = useMemo(() => users.filter(u => selected.includes(u.name)), [users, selected]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" type="button" className="w-44 justify-start font-normal px-2">
                    {selectedUsers.length > 0 ? (
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {selectedUsers.slice(0, 4).map(u => (
                                <Avatar key={u.id} className="size-6 border-2 border-background">
                                    <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
                                </Avatar>
                            ))}
                            {selectedUsers.length > 4 && (
                                <Avatar className="size-6 border-2 border-background">
                                    <AvatarFallback className="text-[10px]">+{selectedUsers.length - 4}</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground">By who</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
                <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="h-8 pl-7 text-sm"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filtered.map(u => (
                        <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                            <Checkbox checked={selected.includes(u.name)} onCheckedChange={() => toggle(u.name)} />
                            <Avatar className="size-5">
                                <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{u.name}</span>
                        </label>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No users found</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
const byWhenYears = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() + i - 1));

function ActionPointsSection({ items, users, onUpdate, onRemove }: {
    items: ActionPoint[];
    users: SimpleUser[];
    onUpdate: (index: number, field: keyof ActionPoint, value: string) => void;
    onRemove: (index: number) => void;
}) {
    const parseByWhen = (val: string | null | undefined) => {
        const parts = (val ?? '').split(' ');
        return { month: parts[0] ?? '', year: parts[1] ?? '' };
    };
    const setByWhen = (index: number, month: string, year: string) => {
        onUpdate(index, 'by_when', month && year ? `${month} ${year}` : month || year);
    };

    return (
        <div className="space-y-3">
            {items.map((ap, i) => {
                const bw = parseByWhen(ap.by_when);
                return (
                    <div key={i} className="flex gap-2 items-start">
                        <Input className="flex-1" placeholder="Action..." value={ap.action ?? ''} onChange={e => onUpdate(i, 'action', e.target.value)} />
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

export default function WhsReportEdit({ report, previousReport, year, month, users, claimsOverview, fyStartYear, trainingCost, csqGlPayments }: Props) {
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
    const [trainingSummary, setTrainingSummary] = useState(report.training_summary ?? '');
    const [bottomActionPoints, setBottomActionPoints] = useState<ActionPoint[]>(report.bottom_action_points ?? []);

    const copyFromPrevious = () => {
        if (!previousReport) return;
        if (!confirm('This will overwrite all current form data with last month\'s report. Continue?')) return;
        setKeyIssues(previousReport.key_issues ?? '');
        setActionPoints(previousReport.action_points ?? []);
        setApprentices(previousReport.apprentices ?? []);
        setTrainingSummary(previousReport.training_summary ?? '');
        setBottomActionPoints(previousReport.bottom_action_points ?? []);
    };

    const handleSave = () => {
        setSaving(true);
        router.put(`/reports/whs-report/${report.id}`, {
            key_issues: keyIssues,
            action_points: actionPoints,
            apprentices,
            training_summary: trainingSummary,
            bottom_action_points: bottomActionPoints,
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
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                            const prevMonth = month === 1 ? 12 : month - 1;
                            const prevYear = month === 1 ? year - 1 : year;
                            router.get(`/reports/whs-report?year=${prevYear}&month=${prevMonth}`);
                        }}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-semibold">WHS Monthly Report: {months[month - 1]} {year}</h1>
                        <Button variant="ghost" size="icon" onClick={() => {
                            const nextMonth = month === 12 ? 1 : month + 1;
                            const nextYear = month === 12 ? year + 1 : year;
                            router.get(`/reports/whs-report?year=${nextYear}&month=${nextMonth}`);
                        }}>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        {previousReport && (
                            <Button variant="outline" onClick={copyFromPrevious}>
                                <ClipboardCopy className="mr-1 h-4 w-4" />
                                Copy from {months[(month === 1 ? 11 : month - 2)]}
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <a href={`/reports/whs-report/pdf?year=${year}&month=${month}`} target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-1 h-4 w-4" /> View PDF
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
                    <CardHeader className="pb-3"><CardTitle className="text-base">Claims Overview (Jul {fyStartYear} – {months[month - 1]} {year})</CardTitle></CardHeader>
                    <CardContent>
                        {claimsOverview.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No claims lodged for the current financial year.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="pb-2 font-medium">Entity</th>
                                        <th className="pb-2 font-medium text-center">Claims Lodged</th>
                                        <th className="pb-2 font-medium text-center">Active Statutory</th>
                                        <th className="pb-2 font-medium text-center">Active Common Law</th>
                                        <th className="pb-2 font-medium text-center">Denied</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claimsOverview.map((co, i) => {
                                        const base = `/injury-register?work_cover_claim=1&fy=${fyStartYear}&fy_month=${month}&fy_year=${year}&entity=${encodeURIComponent(co.entity)}`;
                                        const link = (count: number, extra: string) =>
                                            count > 0 ? (
                                                <a href={`${base}${extra}`} className="text-primary underline hover:text-primary/80">{count}</a>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            );
                                        return (
                                            <tr key={i} className="border-b last:border-0">
                                                <td className="py-2">{co.entity}</td>
                                                <td className="py-2 text-center">{link(co.total_lodged, '')}</td>
                                                <td className="py-2 text-center">{link(co.active_statutory, '&claim_type=statutory&claim_status=active')}</td>
                                                <td className="py-2 text-center">{link(co.active_common_law, '&claim_type=common_law&claim_status=active')}</td>
                                                <td className="py-2 text-center">{link(co.denied, '&claim_status=denied')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                {/* Key Issues */}
                <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">Key Issues Identified</CardTitle></CardHeader>
                    <CardContent>
                        <RichTextEditor content={keyIssues} onChange={setKeyIssues} placeholder="Describe key WHS issues for this month..." />
                    </CardContent>
                </Card>

                {/* Proposed Action Points */}
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Proposed Action Points</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={() => addItem(actionPoints, { action: '', by_who: '', by_when: '' }, setActionPoints)}>
                            <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ActionPointsSection
                            items={actionPoints}
                            users={users}
                            onUpdate={(i, field, value) => updateItem(actionPoints, i, field, value, setActionPoints)}
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
                        {csqGlPayments.length > 0 ? (
                            <div className="space-y-2">
                                {csqGlPayments.map((pay, i) => (
                                    <div key={i} className="flex gap-2 items-center rounded border bg-muted/30 px-3 py-2 text-sm">
                                        <span className="w-24 shrink-0 font-mono text-xs">{pay.reference}</span>
                                        <span className="w-24 shrink-0">{pay.date}</span>
                                        <span className="flex-1 truncate">{pay.description}</span>
                                        <span className="w-28 text-right font-medium">${Number(pay.total).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                                <div className="flex justify-end border-t pt-2">
                                    <span className="text-sm font-semibold">Total: ${csqGlPayments.reduce((s, p) => s + Number(p.total), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No CSQ payments found for this month.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Training Summary */}
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Training Summary</CardTitle>
                        <Card className="bg-muted/50">
                            <CardContent className="py-2 px-3 text-right">
                                <div className="text-sm font-semibold">${trainingCost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
                                <div className="text-xs font-medium text-muted-foreground uppercase">Training Cost – {months[month - 1]}</div>
                            </CardContent>
                        </Card>
                    </CardHeader>
                    <CardContent>
                        <RichTextEditor content={trainingSummary} onChange={setTrainingSummary} placeholder="Training activities this month..." />
                    </CardContent>
                </Card>

                {/* Bottom Action Points */}
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Action Points</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={() => addItem(bottomActionPoints, { action: '', by_who: '', by_when: '' }, setBottomActionPoints)}>
                            <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <ActionPointsSection
                            items={bottomActionPoints}
                            users={users}
                            onUpdate={(i, field, value) => updateItem(bottomActionPoints, i, field, value, setBottomActionPoints)}
                            onRemove={(i) => removeItem(bottomActionPoints, i, setBottomActionPoints)}
                        />
                    </CardContent>
                </Card>

                {/* Bottom save */}
                <div className="flex justify-end gap-2 pb-8">
                    <Button variant="outline" asChild>
                        <a href={`/reports/whs-report/pdf?year=${year}&month=${month}`} target="_blank" rel="noopener noreferrer">
                            <FileText className="mr-1 h-4 w-4" /> View PDF
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
