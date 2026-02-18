import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Activity, ArrowDownRight, ArrowUpRight, Info, Landmark, Wallet } from 'lucide-react';
import type React from 'react';
import { formatAmount } from '../utils';

type SummaryCardVariant = 'default' | 'positive' | 'negative' | 'neutral' | 'dynamic';

type SummaryCardProps = {
    title: string;
    value: number;
    description: string;
    variant?: SummaryCardVariant;
    prefix?: string;
    icon?: React.ReactNode;
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

export const SummaryCard = ({ title, value, description, variant = 'default', prefix = '$', icon }: SummaryCardProps) => {
    const colorClass = getValueColorClass(variant, value);

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="bg-muted px-2 py-1.5 sm:px-3 sm:py-2">
                <div className="flex items-center justify-between">
                    <CardDescription className="text-muted-foreground text-[10px] sm:text-xs font-medium tracking-wide uppercase">{title}</CardDescription>
                    {icon && <span className="text-muted-foreground/60">{icon}</span>}
                </div>
            </CardHeader>
            <CardContent className="px-2 py-1.5 sm:px-3 sm:py-2">
                <CardTitle className={`text-sm sm:text-lg font-semibold whitespace-nowrap tabular-nums ${colorClass}`}>
                    {prefix}
                    {formatAmount(value)}
                </CardTitle>
                <p className="text-muted-foreground mt-0.5 text-[10px] sm:text-xs hidden sm:block">{description}</p>
            </CardContent>
        </Card>
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
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-5">
            <SummaryCard title="Starting Balance" value={startingBalance} description="Opening cash position" variant="default" icon={<Wallet className="h-4 w-4" />} />
            <SummaryCard title="Total Cash In" value={totalCashIn} description="Revenue + GST collected" variant="neutral" icon={<ArrowUpRight className="h-4 w-4" />} />
            <SummaryCard title="Total Cash Out" value={totalCashOut} description="Wages, costs, vendors, GST" variant="neutral" icon={<ArrowDownRight className="h-4 w-4" />} />
            <SummaryCard title="Net Cashflow" value={netCashflow} description="12-month change" variant="dynamic" icon={<Activity className="h-4 w-4" />} />
            <SummaryCard title="Ending Balance" value={endingBalance} description="Projected position" variant="neutral" icon={<Landmark className="h-4 w-4" />} />
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
        <Badge variant={source === 'actual' ? 'default' : source === 'forecast' ? 'secondary' : 'outline'} className={`text-[10px] px-1.5 py-0 font-medium ${className}`}>
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
        <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
                <div className="flex flex-wrap items-center gap-2 text-xs cursor-help">
                    <span className="text-muted-foreground font-medium">Data Source:</span>
                    {showActual && <SourceIndicator source="actual" />}
                    {showForecast && <SourceIndicator source="forecast" />}
                    {showMixed && <SourceIndicator source="mixed" />}
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-72 text-xs space-y-2.5">
                <p className="font-semibold text-sm">Data Source Legend</p>
                <div className="space-y-2">
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5"><SourceIndicator source="actual" /></span>
                        <div>
                            <span className="font-medium">Actual</span>
                            <p className="text-muted-foreground">Invoiced or committed amounts from Premier</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5"><SourceIndicator source="forecast" /></span>
                        <div>
                            <span className="font-medium">Forecast</span>
                            <p className="text-muted-foreground">Remaining expected amounts not yet invoiced</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5"><SourceIndicator source="mixed" /></span>
                        <div>
                            <span className="font-medium">Mixed</span>
                            <p className="text-muted-foreground">Combination of actual and remaining forecast data</p>
                        </div>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};
