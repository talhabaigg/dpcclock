import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { JobSummary, Location } from '@/types';

interface OtherItemsCardProps {
    location: Location & {
        job_summary?: JobSummary;
    };
    claimedToDate?: number;
    cashRetention?: number;
    isEditing?: boolean;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            notation: 'compact',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);
    }
    return formatCurrency(value);
};

export default function OtherItemsCard({ location, claimedToDate, cashRetention, isEditing }: OtherItemsCardProps) {
    const jobSummary = location.job_summary;

    const claimedPct =
        jobSummary?.current_estimate_revenue && jobSummary.current_estimate_revenue !== 0 && claimedToDate
            ? (claimedToDate / jobSummary.current_estimate_revenue) * 100
            : null;

    const underOver = jobSummary?.over_under_billing ?? null;
    const isUnder = underOver !== null && underOver < 0;
    const isOver = underOver !== null && underOver > 0;

    if (!jobSummary) {
        return (
            <Card className="w-full p-0 gap-0 h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Billing Position</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No financial data available for location {location.external_id || 'N/A'}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Billing Position</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col justify-evenly px-2 py-1.5">
                {/* Hero: Over/Under Billed */}
                <div className="flex flex-col items-center gap-0.5">
                    <span
                        className={cn(
                            'text-lg sm:text-xl font-bold tabular-nums leading-none',
                            isUnder && 'text-red-600 dark:text-red-400',
                            isOver && 'text-green-600 dark:text-green-400',
                        )}
                    >
                        {underOver !== null ? formatCompact(underOver) : '-'}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none">
                        {isUnder ? 'under-billed' : isOver ? 'over-billed' : 'over/under billed'}
                    </span>
                </div>

                {/* Progress: Claimed to Date */}
                {claimedPct !== null && (
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-none">Claimed</span>
                            <span className="text-[10px] sm:text-[11px] font-semibold tabular-nums leading-none">{claimedPct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${Math.min(claimedPct, 100)}%`,
                                    backgroundColor: claimedPct > 100 ? 'hsl(38, 92%, 50%)' : 'hsl(217, 91%, 60%)',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Footnote: Retention */}
                <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none">Retention held</span>
                    <span className="text-[9px] sm:text-[10px] font-medium tabular-nums leading-none">
                        {formatCompact(cashRetention ?? 0)}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
