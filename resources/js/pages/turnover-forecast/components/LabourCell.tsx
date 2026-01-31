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

    const varianceColor =
        varianceRounded < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-green-600 dark:text-green-400';

    return (
        <div className="flex flex-col justify-center h-full py-0.5 text-xs text-right">
            <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-normal">
                    Req
                </span>
                <span className="tabular-nums">{reqRounded}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
                <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-normal">
                    Fcst
                </span>
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
