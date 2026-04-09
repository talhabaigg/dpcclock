import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { DatePickerDemo } from '@/components/date-picker';
import { SearchSelect } from '@/components/search-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { format, parse } from 'date-fns';
import { ChevronLeft, ChevronRight, ClipboardCopy, FileText, Loader2, Plus, Save, Search, Trash2, Users } from 'lucide-react';
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
    projectLocations: string[];
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
                    <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-start">
                        <Input className="flex-1" placeholder="Action..." value={ap.action ?? ''} onChange={e => onUpdate(i, 'action', e.target.value)} />
                        <div className="flex gap-2 items-start">
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
                    </div>
                );
            })}
        </div>
    );
}

export default function WhsReportEdit({ report, previousReport, year, month, users, claimsOverview, fyStartYear, trainingCost, csqGlPayments, projectLocations }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props as { flash: { success?: string; error?: string } };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Safety Dashboard', href: '/safety-dashboard' },
        { title: `WHS Report - ${months[month - 1]} ${year}`, href: '#' },
    ];

    const [saving, setSaving] = useState(false);
    const [keyIssues, setKeyIssues] = useState(report.key_issues ?? '');
    const [actionPoints, setActionPoints] = useState<ActionPoint[]>(report.action_points ?? []);
    const [apprentices, setApprentices] = useState<Apprentice[]>(report.apprentices ?? []);
    const [trainingSummary, setTrainingSummary] = useState(report.training_summary ?? '');
    const [bottomActionPoints, setBottomActionPoints] = useState<ActionPoint[]>(report.bottom_action_points ?? []);
    const [loadingApprentices, setLoadingApprentices] = useState(false);

    const projectOptions = useMemo(() => projectLocations.map(name => ({ value: name, label: name })), [projectLocations]);

    const populateApprentices = async () => {
        if (apprentices.length > 0 && !confirm('This will replace existing apprentices with data from employees. Continue?')) return;
        setLoadingApprentices(true);
        try {
            const res = await fetch('/reports/whs-report/apprentices-from-employees');
            const data = await res.json();
            if (data.success) {
                setApprentices(data.apprentices);
            }
        } catch {
            // ignore
        } finally {
            setLoadingApprentices(false);
        }
    };

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

            <div className="mx-auto w-full max-w-5xl space-y-4 p-4 overflow-x-hidden">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}
                {flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

                <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                            const prevMonth = month === 1 ? 12 : month - 1;
                            const prevYear = month === 1 ? year - 1 : year;
                            router.get(`/reports/whs-report?year=${prevYear}&month=${prevMonth}`);
                        }}>
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-lg sm:text-2xl font-semibold truncate">WHS Monthly Report: {months[month - 1]} {year}</h1>
                        <Button variant="ghost" size="icon" onClick={() => {
                            const nextMonth = month === 12 ? 1 : month + 1;
                            const nextYear = month === 12 ? year + 1 : year;
                            router.get(`/reports/whs-report?year=${nextYear}&month=${nextMonth}`);
                        }}>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {previousReport && (
                            <Button variant="outline" size="sm" onClick={copyFromPrevious}>
                                <ClipboardCopy className="mr-1 h-4 w-4" />
                                <span className="hidden sm:inline">Copy from </span>{months[(month === 1 ? 11 : month - 2)]}
                            </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/reports/whs-report/pdf?year=${year}&month=${month}`} target="_blank" rel="noopener noreferrer">
                                <FileText className="mr-1 h-4 w-4" /> View PDF
                            </a>
                        </Button>
                        <div className="flex-1" />
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>

                {/* Claims Overview */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="text-base font-semibold">Claims Overview</h3>
                        <span className="text-xs text-muted-foreground">Jul {fyStartYear} – {months[month - 1]} {year}</span>
                    </div>
                    {claimsOverview.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">No claims lodged for the current financial year.</p>
                    ) : (
                        <div className="rounded-md border border-input shadow-xs overflow-x-auto">
                            <table className="w-full text-sm min-w-[480px]">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Entity</th>
                                        <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Lodged</th>
                                        <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Statutory</th>
                                        <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Common Law</th>
                                        <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Denied</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claimsOverview.map((co, i) => {
                                        const base = `/injury-register?work_cover_claim=1&fy=${fyStartYear}&fy_month=${month}&fy_year=${year}&entity=${encodeURIComponent(co.entity)}`;
                                        const link = (count: number, extra: string) =>
                                            count > 0 ? (
                                                <a href={`${base}${extra}`} className="text-primary font-medium hover:underline">{count}</a>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            );
                                        return (
                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-2.5 font-medium">{co.entity}</td>
                                                <td className="px-4 py-2.5 text-center">{link(co.total_lodged, '')}</td>
                                                <td className="px-4 py-2.5 text-center">{link(co.active_statutory, '&claim_type=statutory&claim_status=active')}</td>
                                                <td className="px-4 py-2.5 text-center">{link(co.active_common_law, '&claim_type=common_law&claim_status=active')}</td>
                                                <td className="px-4 py-2.5 text-center">{link(co.denied, '&claim_status=denied')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Key Issues */}
                <div>
                    <h3 className="text-base font-semibold mb-2">Key Issues Identified</h3>
                    <AiRichTextEditor content={keyIssues} onChange={setKeyIssues} placeholder="Describe key WHS issues for this month..." />
                </div>

                {/* Proposed Action Points */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold">Proposed Action Points</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => addItem(actionPoints, { action: '', by_who: '', by_when: '' }, setActionPoints)}>
                            <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                    </div>
                    <ActionPointsSection
                        items={actionPoints}
                        users={users}
                        onUpdate={(i, field, value) => updateItem(actionPoints, i, field, value, setActionPoints)}
                        onRemove={(i) => removeItem(actionPoints, i, setActionPoints)}
                    />
                </div>

                {/* Apprentice Overview */}
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h3 className="text-base font-semibold">Apprentice Overview</h3>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={populateApprentices} disabled={loadingApprentices}>
                                {loadingApprentices ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Users className="mr-1 h-3 w-3" />}
                                <span className="sm:hidden">Load</span>
                                <span className="hidden sm:inline">Load Apprentices</span>
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => addItem(apprentices, { name: '', project: '', year_level: '', completion_date: '', comments: '' }, setApprentices)}>
                                <Plus className="mr-1 h-3 w-3" /> Add
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {apprentices.map((app, i) => (
                            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 rounded-md border border-input p-3 sm:border-0 sm:p-0">
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_16rem_4rem_10rem] gap-2 sm:items-start">
                                    <Input placeholder="Name" value={app.name} onChange={e => updateItem(apprentices, i, 'name', e.target.value, setApprentices)} />
                                    <SearchSelect
                                        options={projectOptions}
                                        optionName="Project"
                                        selectedOption={app.project}
                                        onValueChange={v => updateItem(apprentices, i, 'project', v, setApprentices)}
                                    />
                                    <Input placeholder="Yr" value={app.year_level} onChange={e => updateItem(apprentices, i, 'year_level', e.target.value, setApprentices)} />
                                    <DatePickerDemo
                                        className="w-full"
                                        placeholder="Completion"
                                        displayFormat="MMM yyyy"
                                        value={(() => {
                                            if (!app.completion_date) return undefined;
                                            try {
                                                const d = parse(app.completion_date, 'MMM yyyy', new Date());
                                                return isNaN(d.getTime()) ? undefined : d;
                                            } catch { return undefined; }
                                        })()}
                                        onChange={date => updateItem(apprentices, i, 'completion_date', date ? format(date, 'MMM yyyy') : '', setApprentices)}
                                    />
                                </div>
                                <div className="flex gap-2 items-start">
                                    <Input className="flex-1 sm:w-48" placeholder="Comments" value={app.comments} onChange={e => updateItem(apprentices, i, 'comments', e.target.value, setApprentices)} />
                                    <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(apprentices, i, setApprentices)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CSQ Payments */}
                <div>
                    <h3 className="text-base font-semibold mb-3">CSQ Payments Received</h3>
                    {csqGlPayments.length > 0 ? (
                        <div className="rounded-md border border-input shadow-xs overflow-x-auto">
                            <table className="w-full text-sm min-w-[480px]">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Reference</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Date</th>
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                                        <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {csqGlPayments.map((pay, i) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-2.5 font-mono text-xs">{pay.reference}</td>
                                            <td className="px-4 py-2.5">{pay.date}</td>
                                            <td className="px-4 py-2.5">{pay.description}</td>
                                            <td className="px-4 py-2.5 text-right font-medium">${Number(pay.total).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/40">
                                        <td colSpan={3} className="px-4 py-2.5 text-right font-semibold">Total</td>
                                        <td className="px-4 py-2.5 text-right font-semibold">${csqGlPayments.reduce((s, p) => s + Number(p.total), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">No CSQ payments found for this month.</p>
                    )}
                </div>

                {/* Training Summary */}
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h3 className="text-base font-semibold">Training Summary</h3>
                        <div className="rounded-md border border-input shadow-xs px-3 py-1.5 text-right">
                            <div className="text-sm font-semibold">${trainingCost.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
                            <div className="text-xs text-muted-foreground">Training Cost – {months[month - 1]}</div>
                        </div>
                    </div>
                    <AiRichTextEditor content={trainingSummary} onChange={setTrainingSummary} placeholder="Training activities this month..." />
                </div>

                {/* Bottom Action Points */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold">Action Points</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => addItem(bottomActionPoints, { action: '', by_who: '', by_when: '' }, setBottomActionPoints)}>
                            <Plus className="mr-1 h-3 w-3" /> Add
                        </Button>
                    </div>
                    <ActionPointsSection
                        items={bottomActionPoints}
                        users={users}
                        onUpdate={(i, field, value) => updateItem(bottomActionPoints, i, field, value, setBottomActionPoints)}
                        onRemove={(i) => removeItem(bottomActionPoints, i, setBottomActionPoints)}
                    />
                </div>

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
