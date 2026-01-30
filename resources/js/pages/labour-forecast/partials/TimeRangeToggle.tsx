/**
 * Time Range Toggle Component
 *
 * PURPOSE:
 * Provides toggle buttons for filtering chart data by time range.
 * Options include 1 month, 3 months, 6 months, or all data.
 *
 * FEATURES:
 * - Compact toggle button group
 * - Selection persisted to localStorage
 *
 * USED BY:
 * - InlineChartSection
 *
 * PROPS:
 * - timeRange: Currently selected time range
 * - onTimeRangeChange: Callback when selection changes
 */

import type { TimeRange } from '../types';
import { TIME_RANGE_OPTIONS } from './utils';

interface TimeRangeToggleProps {
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
}

export const TimeRangeToggle = ({ timeRange, onTimeRangeChange }: TimeRangeToggleProps) => {
    return (
        <div className="inline-flex flex-shrink-0 rounded-lg bg-slate-200/80 p-0.5 sm:p-1 dark:bg-slate-700">
            {TIME_RANGE_OPTIONS.map((range) => (
                <button
                    key={range.id}
                    className={`flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-all sm:px-2.5 sm:text-xs ${
                        timeRange === range.id
                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    onClick={() => onTimeRangeChange(range.id)}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
};
