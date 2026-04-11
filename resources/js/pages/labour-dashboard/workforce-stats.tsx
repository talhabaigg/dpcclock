import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock } from 'lucide-react';

export interface WorkforceStatsData {
    total_workers: number;
    average_age: number | null;
    workers_over_50_pct: number;
    workers_under_30_pct: number;
    average_tenure: number | null;
    workers_over_2_years: number;
    workers_over_5_years: number;
    workers_over_10_years: number;
    workers_over_20_years: number;
}

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex flex-col items-center gap-0.5 py-2">
            <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
            <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
            {sub && <div className="text-[9px] text-muted-foreground/70">{sub}</div>}
        </div>
    );
}

interface WorkforceStatsProps {
    data: WorkforceStatsData | null;
}

export default function WorkforceStats({ data }: WorkforceStatsProps) {
    if (!data) return null;

    return (
        <>
            {/* Worker Stats */}
            <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Worker Stats</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex items-center">
                    <div className="grid grid-cols-4 divide-x w-full">
                        <StatItem label="Total Workers" value={data.total_workers.toString()} />
                        <StatItem
                            label="Average Age"
                            value={data.average_age !== null ? data.average_age.toFixed(1) : '-'}
                        />
                        <StatItem
                            label="Over 50"
                            value={`${data.workers_over_50_pct}%`}
                        />
                        <StatItem
                            label="Under 30"
                            value={`${data.workers_under_30_pct}%`}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tenure Stats */}
            <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Tenure Stats</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex items-center">
                    <div className="grid grid-cols-5 divide-x w-full">
                        <StatItem
                            label="Average"
                            value={data.average_tenure !== null ? `${data.average_tenure.toFixed(1)}y` : '-'}
                        />
                        <StatItem label="> 2 Years" value={data.workers_over_2_years.toString()} />
                        <StatItem label="> 5 Years" value={data.workers_over_5_years.toString()} />
                        <StatItem label="> 10 Years" value={data.workers_over_10_years.toString()} />
                        <StatItem label="> 20 Years" value={data.workers_over_20_years.toString()} />
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
