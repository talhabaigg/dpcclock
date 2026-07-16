import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Clock, Hammer } from 'lucide-react';
import { useMemo } from 'react';
import type { HoursMatrixRow } from './hours-matrix-table';

interface TimeRatiosBarProps {
    data: HoursMatrixRow[];
}

// Muted palette from the Casual performance v2 design.
const NT_COLOR = '#6f8fc4';
const OT_COLOR = '#d6a75f';
const LOST_COLOR = '#d4d4d8';

const NP_COLORS: Record<string, string> = {
    annual_leave: '#5f9e7f',
    sick_leave: '#cf7d6a',
    safety: '#d6a75f',
    rdo: '#a48bc2',
    weather: '#7aa9c9',
    public_holiday: '#8f9fc9',
};

interface Segment {
    key: string;
    label: string;
    color: string;
    raw: number; // % of total available hours
}

function SegmentedBar({ segments, className }: { segments: Segment[]; className?: string }) {
    const sum = segments.reduce((s, seg) => s + seg.raw, 0);
    return (
        <div className={cn('flex gap-[3px] overflow-hidden rounded-md bg-muted', className)}>
            {sum > 0 &&
                segments
                    .filter((seg) => seg.raw > 0)
                    .map((seg) => <div key={seg.key} style={{ width: `${(seg.raw / sum) * 100}%`, background: seg.color }} />)}
        </div>
    );
}

export default function TimeRatiosBar({ data }: TimeRatiosBarProps) {
    const computed = useMemo(() => {
        const totalWorked = data.reduce((sum, r) => sum + r.total_hours_worked, 0);
        const totalAvailable = data.reduce((sum, r) => sum + r.total_available_hours, 0);
        if (totalAvailable === 0) return null;

        const rawPct = (val: number) => parseFloat(((val / totalAvailable) * 100).toFixed(2));

        const nt = data.reduce((s, r) => s + r.normal_time, 0);
        const ot = data.reduce((s, r) => s + r.overtime, 0);
        const lost = data.reduce((s, r) => s + r.total_hours_lost, 0);

        const workedSegments: Segment[] = [
            { key: 'normal_time', label: 'Normal Time', color: NT_COLOR, raw: rawPct(nt) },
            { key: 'overtime', label: 'Overtime', color: OT_COLOR, raw: rawPct(ot) },
            { key: 'lost', label: 'Hours Lost', color: LOST_COLOR, raw: rawPct(lost) },
        ];

        // Sorted by share so the bar and breakdown read largest-first; zeros sink to the end (dimmed).
        const npItems: Segment[] = [
            { key: 'annual_leave', label: 'Annual Leave', color: NP_COLORS.annual_leave, raw: rawPct(data.reduce((s, r) => s + r.annual_leave_hours, 0)) },
            { key: 'sick_leave', label: 'Sick Leave', color: NP_COLORS.sick_leave, raw: rawPct(data.reduce((s, r) => s + r.sick_leave_hours, 0)) },
            { key: 'safety', label: 'Safety', color: NP_COLORS.safety, raw: rawPct(data.reduce((s, r) => s + r.safety_hours, 0)) },
            { key: 'rdo', label: 'RDO', color: NP_COLORS.rdo, raw: rawPct(data.reduce((s, r) => s + r.rdo_hours, 0)) },
            { key: 'weather', label: 'Weather', color: NP_COLORS.weather, raw: rawPct(data.reduce((s, r) => s + r.weather_hours, 0)) },
            { key: 'public_holiday', label: 'Public Holiday', color: NP_COLORS.public_holiday, raw: rawPct(data.reduce((s, r) => s + r.public_holiday_hours, 0)) },
        ].sort((a, b) => b.raw - a.raw);

        return {
            effPct: ((totalWorked / totalAvailable) * 100).toFixed(1),
            workedSegments,
            npItems,
            lostPct: rawPct(lost),
        };
    }, [data]);

    if (!computed) return null;

    return (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
            {/* Hours Worked */}
            <Card className="justify-center gap-0 px-[22px] py-5">
                <div className="mb-[18px] flex items-center gap-2">
                    <Hammer className="h-[17px] w-[17px] text-muted-foreground" />
                    <h3 className="text-base font-semibold tracking-tight">Hours Worked</h3>
                </div>
                <div className="flex flex-col gap-[18px]">
                    <div>
                        <div className="font-mono text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{computed.effPct}%</div>
                        <div className="mt-2 text-[11px] text-muted-foreground">of scheduled hours worked</div>
                    </div>
                    <div>
                        <SegmentedBar segments={computed.workedSegments} className="mb-3.5 h-3" />
                        {computed.workedSegments.map((seg) => (
                            <div key={seg.key} className="flex items-center gap-2.5 py-[7px]">
                                <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: seg.color }} />
                                <span className="flex-1 text-xs text-muted-foreground">{seg.label}</span>
                                <span
                                    className={cn(
                                        'font-mono text-[15px] font-semibold tabular-nums',
                                        seg.key === 'lost' && 'text-muted-foreground',
                                    )}
                                >
                                    {seg.raw.toFixed(2)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Hours Absent */}
            <Card className="justify-center gap-0 px-[22px] py-5">
                <div className="mb-[22px] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-[17px] w-[17px] text-muted-foreground" />
                        <h3 className="text-base font-semibold tracking-tight">Hours Absent</h3>
                    </div>
                    <div className="flex items-baseline gap-1.5 rounded-lg bg-muted px-3 py-[5px]">
                        <span className="font-mono text-[13px] font-semibold tabular-nums">{computed.lostPct.toFixed(2)}%</span>
                        <span className="text-xs text-muted-foreground">Total Lost</span>
                    </div>
                </div>

                <SegmentedBar segments={computed.npItems} className="mb-6 h-[30px] rounded-[7px]" />

                <div className="grid grid-cols-3 gap-x-5 gap-y-[18px] md:grid-cols-6">
                    {computed.npItems.map((item) => {
                        const isZero = item.raw === 0;
                        return (
                            <div key={item.key}>
                                <div
                                    className={cn(
                                        'font-mono text-base tracking-tight tabular-nums',
                                        isZero ? 'font-medium text-muted-foreground/50' : 'font-semibold',
                                    )}
                                >
                                    {item.raw.toFixed(2)}%
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                    <span
                                        className={cn('h-[9px] w-[9px] flex-none rounded-full', isZero && 'bg-muted')}
                                        style={isZero ? undefined : { background: item.color }}
                                    />
                                    <span className={cn('text-[10px]', isZero ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}
