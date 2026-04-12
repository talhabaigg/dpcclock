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
        <div className="bg-muted inline-flex flex-shrink-0 rounded-md p-0.5">
            {TIME_RANGE_OPTIONS.map((range) => (
                <button
                    key={range.id}
                    className={`flex items-center justify-center rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                        timeRange === range.id
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => onTimeRangeChange(range.id)}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
};
