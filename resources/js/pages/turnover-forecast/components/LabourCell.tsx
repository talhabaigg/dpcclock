import type { UnifiedRow } from '../lib/data-transformer';

interface LabourCellProps {
    data: UnifiedRow;
    month: string;
}

export function LabourCell({ data, month }: LabourCellProps) {
    const reqValue = data.labourRequired?.[month] ?? 0;
    const forecastValue = data.labourForecast?.[month];

    const reqRounded = Math.ceil(reqValue);

    // If no forecast, just show requirement
    if (!forecastValue) {
        return <span className="tabular-nums">Req: {reqRounded}</span>;
    }

    const forecastRounded = Math.round(forecastValue * 10) / 10;
    const variance = forecastRounded - reqRounded;
    const varianceRounded = Math.round(variance * 10) / 10;

    const varianceColor = varianceRounded < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';

    return (
        <div className="flex h-full flex-col justify-center py-0.5 text-right text-xs">
            <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] font-normal text-slate-500 uppercase dark:text-slate-400">Req</span>
                <span className="tabular-nums">{reqRounded}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] font-normal text-slate-500 uppercase dark:text-slate-400">Fcst</span>
                <div className="flex items-center gap-1">
                    <span className="font-bold tabular-nums">{forecastRounded}</span>
                    <span className={`text-[10px] font-bold ${varianceColor}`}>
                        ({varianceRounded > 0 ? '+' : ''}
                        {varianceRounded})
                    </span>
                </div>
            </div>
        </div>
    );
}
