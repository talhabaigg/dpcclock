import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAmount } from '../utils';

type SummaryCardVariant = 'default' | 'positive' | 'negative' | 'neutral' | 'dynamic';

type SummaryCardProps = {
    title: string;
    value: number;
    description: string;
    variant?: SummaryCardVariant;
    prefix?: string;
};

const getValueColorClass = (variant: SummaryCardVariant, value: number): string => {
    switch (variant) {
        case 'positive':
            return 'text-green-600 dark:text-green-400';
        case 'negative':
            return 'text-red-600 dark:text-red-400';
        case 'neutral':
            return 'text-blue-600 dark:text-blue-400';
        case 'dynamic':
            return value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        default:
            return '';
    }
};

export const SummaryCard = ({
    title,
    value,
    description,
    variant = 'default',
    prefix = '$',
}: SummaryCardProps) => {
    const colorClass = getValueColorClass(variant, value);

    return (
        <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    {title}
                </CardDescription>
                <CardTitle className={`text-2xl font-bold tabular-nums ${colorClass}`}>
                    {prefix}
                    {formatAmount(value)}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
            {variant !== 'default' && (
                <div
                    className={`absolute top-0 right-0 w-1 h-full ${
                        variant === 'positive' || (variant === 'dynamic' && value >= 0)
                            ? 'bg-green-500'
                            : variant === 'negative' || (variant === 'dynamic' && value < 0)
                              ? 'bg-red-500'
                              : variant === 'neutral'
                                ? 'bg-blue-500'
                                : ''
                    }`}
                />
            )}
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

export const SummaryCardsGrid = ({
    startingBalance,
    totalCashIn,
    totalCashOut,
    netCashflow,
    endingBalance,
}: SummaryCardsGridProps) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryCard
                title="Starting Balance"
                value={startingBalance}
                description="Opening cash position"
                variant="default"
            />
            <SummaryCard
                title="Total Cash In"
                value={totalCashIn}
                description="Revenue + GST collected"
                variant="positive"
            />
            <SummaryCard
                title="Total Cash Out"
                value={totalCashOut}
                description="Wages, costs, vendors, GST"
                variant="negative"
            />
            <SummaryCard
                title="Net Cashflow"
                value={netCashflow}
                description="12-month change"
                variant="dynamic"
            />
            <SummaryCard
                title="Ending Balance"
                value={endingBalance}
                description="Projected position"
                variant="dynamic"
            />
        </div>
    );
};

type SourceIndicatorProps = {
    source: 'actual' | 'forecast' | 'mixed' | undefined;
    className?: string;
};

export const SourceIndicator = ({ source, className = '' }: SourceIndicatorProps) => {
    if (!source) return null;

    const config = {
        actual: {
            color: 'bg-blue-500',
            label: 'Actual',
            textColor: 'text-blue-700 dark:text-blue-300',
            bgColor: 'bg-blue-50 dark:bg-blue-950/50',
        },
        forecast: {
            color: 'bg-amber-500',
            label: 'Forecast',
            textColor: 'text-amber-700 dark:text-amber-300',
            bgColor: 'bg-amber-50 dark:bg-amber-950/50',
        },
        mixed: {
            color: 'bg-gradient-to-r from-blue-500 to-amber-500',
            label: 'Mixed',
            textColor: 'text-slate-700 dark:text-slate-300',
            bgColor: 'bg-slate-50 dark:bg-slate-800/50',
        },
    };

    const { color, label, textColor, bgColor } = config[source];

    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${textColor} ${bgColor} ${className}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
            {label}
        </span>
    );
};

type DataSourceLegendProps = {
    showActual?: boolean;
    showForecast?: boolean;
    showMixed?: boolean;
};

export const DataSourceLegend = ({
    showActual = true,
    showForecast = true,
    showMixed = true,
}: DataSourceLegendProps) => {
    return (
        <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-muted-foreground font-medium">Data Source:</span>
            {showActual && (
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground">Actual (invoiced/committed)</span>
                </div>
            )}
            {showForecast && (
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground">Forecast (remaining expected)</span>
                </div>
            )}
            {showMixed && (
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-amber-500" />
                    <span className="text-muted-foreground">Mixed (actual + remaining forecast)</span>
                </div>
            )}
        </div>
    );
};
