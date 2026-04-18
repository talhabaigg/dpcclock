import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { formatAmount } from '../utils';

type SummaryCardVariant = 'default' | 'positive' | 'negative' | 'neutral' | 'dynamic';
type SummaryCardAccent = 'slate' | 'sky' | 'amber' | 'emerald' | 'rose';

type SummaryCardProps = {
    title: string;
    value: number;
    variant?: SummaryCardVariant;
    accent?: SummaryCardAccent;
    prefix?: string;
    className?: string;
};

const getValueColorClass = (variant: SummaryCardVariant, value: number): string => {
    switch (variant) {
        case 'positive':
            return 'text-emerald-600 dark:text-emerald-400';
        case 'negative':
            return 'text-red-600 dark:text-red-400';
        case 'neutral':
            return 'text-foreground';
        case 'dynamic':
            return value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
        default:
            return 'text-foreground';
    }
};

const accentBgClass: Record<SummaryCardAccent, string> = {
    slate: '',
    sky: '',
    amber: '',
    emerald: 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06]',
    rose: 'bg-rose-500/[0.04] dark:bg-rose-400/[0.06]',
};

export const SummaryCard = ({
    title,
    value,
    variant = 'default',
    accent = 'slate',
    prefix = '$',
    className,
}: SummaryCardProps) => {
    const valueColorClass = getValueColorClass(variant, value);
    const hasTint = accent === 'emerald' || accent === 'rose';

    return (
        <div
            className={cn(
                'rounded-xl px-4 py-3.5 ring-1 sm:px-5 sm:py-4',
                hasTint ? 'ring-border/70' : 'ring-border/50',
                accentBgClass[accent],
                className,
            )}
        >
            <p className="text-muted-foreground text-xs font-medium tracking-tight">{title}</p>
            <p className={cn('mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-[1.625rem]', valueColorClass)}>
                <span className="mr-[0.05em]">{prefix}</span>
                <span className="whitespace-nowrap">{formatAmount(value)}</span>
            </p>
        </div>
    );
};

type SummaryCardsGridProps = {
    startingBalance: number;
    totalCashIn: number;
    totalCashOut: number;
    netCashflow: number;
    endingBalance: number;
};

export const SummaryCardsGrid = ({ startingBalance, totalCashIn, totalCashOut, netCashflow, endingBalance }: SummaryCardsGridProps) => {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard title="Ending Balance" value={endingBalance} />
            <SummaryCard title="Net Cashflow" value={netCashflow} />
            <SummaryCard title="Starting Balance" value={startingBalance} />
            <SummaryCard title="Total Cash In" value={totalCashIn} />
            <SummaryCard title="Total Cash Out" value={totalCashOut} />
        </div>
    );
};

type SourceIndicatorProps = {
    source: 'actual' | 'forecast' | 'mixed' | undefined;
    className?: string;
};

export const SourceIndicator = ({ source, className = '' }: SourceIndicatorProps) => {
    if (!source) return null;

    const label = source === 'actual' ? 'Actual' : source === 'forecast' ? 'Forecast' : 'Mixed';

    return (
        <Badge
            variant={source === 'actual' ? 'default' : source === 'forecast' ? 'secondary' : 'outline'}
            className={`px-1.5 py-0 text-[10px] font-medium ${className}`}
        >
            {label}
        </Badge>
    );
};

type DataSourceLegendProps = {
    showActual?: boolean;
    showForecast?: boolean;
    showMixed?: boolean;
};

export const DataSourceLegend = ({ showActual = true, showForecast = true, showMixed = true }: DataSourceLegendProps) => {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:bg-muted/35 hover:text-foreground h-6 px-1.5 font-normal"
                >
                    <Info className="h-3 w-3" />
                    Sources
                </Button>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-72 space-y-2.5 text-xs">
                <p className="text-sm font-semibold">Data Source Legend</p>
                <div className="space-y-2">
                    {showActual && (
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5">
                                <SourceIndicator source="actual" />
                            </span>
                            <div>
                                <span className="font-medium">Actual</span>
                                <p className="text-muted-foreground">Invoiced or committed amounts from Premier</p>
                            </div>
                        </div>
                    )}
                    {showForecast && (
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5">
                                <SourceIndicator source="forecast" />
                            </span>
                            <div>
                                <span className="font-medium">Forecast</span>
                                <p className="text-muted-foreground">Remaining expected amounts not yet invoiced</p>
                            </div>
                        </div>
                    )}
                    {showMixed && (
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5">
                                <SourceIndicator source="mixed" />
                            </span>
                            <div>
                                <span className="font-medium">Mixed</span>
                                <p className="text-muted-foreground">Combination of actual and remaining forecast data</p>
                            </div>
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};
