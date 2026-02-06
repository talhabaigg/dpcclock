/**
 * Detail Panel Component
 *
 * PURPOSE:
 * Renders a detail table showing hour breakdowns for a work type.
 * Displays inline within the main grid when a parent row is expanded.
 *
 * FEATURES:
 * - Shows Ordinary Hours, OT Hours, Leave Hours, RDO Hours, PH Hours
 * - Editable cells that update parent headcount or hour values
 * - Columns aligned with parent grid via scroll sync
 * - Light/dark theme support
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Week } from '../types';

interface HourRowData {
    type: 'ordinary' | 'overtime' | 'leave' | 'rdo' | 'ph';
    label: string;
    values: { [weekKey: string]: number };
    editable: boolean;
    colorClass: string;
}

// Column width matching parent grid
const WEEK_COL_WIDTH = 90;

interface DetailPanelProps {
    weeks: Week[];
    hoursPerWeek: number;
    headcountByWeek: { [weekKey: string]: number };
    overtimeByWeek: { [weekKey: string]: number };
    leaveByWeek: { [weekKey: string]: number };
    rdoByWeek: { [weekKey: string]: number };
    phByWeek: { [weekKey: string]: number };
    overtimeEnabled: boolean;
    onOrdinaryHoursChange: (weekKey: string, hours: number) => void;
    onOvertimeChange: (weekKey: string, hours: number) => void;
    onLeaveChange: (weekKey: string, hours: number) => void;
    onRdoChange: (weekKey: string, hours: number) => void;
    onPhChange: (weekKey: string, hours: number) => void;
    isEditingLocked: boolean;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export const DetailPanel = ({
    weeks,
    hoursPerWeek,
    headcountByWeek,
    overtimeByWeek,
    leaveByWeek,
    rdoByWeek,
    phByWeek,
    overtimeEnabled,
    onOrdinaryHoursChange,
    onOvertimeChange,
    onLeaveChange,
    onRdoChange,
    onPhChange,
    isEditingLocked,
    scrollContainerRef,
}: DetailPanelProps) => {
    // Build hour rows
    const hourRows: HourRowData[] = [
        {
            type: 'ordinary',
            label: 'Ordinary Hours',
            values: Object.fromEntries(weeks.map((w) => [w.key, (headcountByWeek[w.key] || 0) * hoursPerWeek])),
            editable: true,
            colorClass: 'bg-teal-500',
        },
    ];

    if (overtimeEnabled) {
        hourRows.push({
            type: 'overtime',
            label: 'OT Hours',
            values: overtimeByWeek,
            editable: true,
            colorClass: 'bg-orange-500',
        });
    }

    hourRows.push(
        {
            type: 'leave',
            label: 'Leave Hours',
            values: leaveByWeek,
            editable: true,
            colorClass: 'bg-blue-500',
        },
        {
            type: 'rdo',
            label: 'RDO Hours',
            values: rdoByWeek,
            editable: true,
            colorClass: 'bg-purple-500',
        },
        {
            type: 'ph',
            label: 'PH Not Worked',
            values: phByWeek,
            editable: true,
            colorClass: 'bg-indigo-500',
        },
    );

    const handleCellChange = useCallback(
        (type: HourRowData['type'], weekKey: string, value: string) => {
            const numValue = Math.max(0, Number(value) || 0);
            switch (type) {
                case 'ordinary':
                    onOrdinaryHoursChange(weekKey, numValue);
                    break;
                case 'overtime':
                    onOvertimeChange(weekKey, Math.floor(numValue));
                    break;
                case 'leave':
                    onLeaveChange(weekKey, numValue);
                    break;
                case 'rdo':
                    onRdoChange(weekKey, numValue);
                    break;
                case 'ph':
                    onPhChange(weekKey, numValue);
                    break;
            }
        },
        [onOrdinaryHoursChange, onOvertimeChange, onLeaveChange, onRdoChange, onPhChange],
    );

    // Calculate totals for each row
    const calculateTotal = (values: { [weekKey: string]: number }) => {
        return weeks.reduce((sum, week) => sum + (values[week.key] || 0), 0);
    };

    const localScrollRef = useRef<HTMLDivElement>(null);

    // Sync scroll with parent grid's scroll container
    useEffect(() => {
        const parentScrollContainer = scrollContainerRef?.current;
        const localScroll = localScrollRef.current;

        if (!parentScrollContainer || !localScroll) return;

        const syncFromParent = () => {
            if (localScroll) {
                localScroll.scrollLeft = parentScrollContainer.scrollLeft;
            }
        };

        const syncToParent = () => {
            if (parentScrollContainer) {
                parentScrollContainer.scrollLeft = localScroll.scrollLeft;
            }
        };

        // Initial sync
        syncFromParent();

        // Listen for parent scroll
        parentScrollContainer.addEventListener('scroll', syncFromParent);
        // Also allow detail panel to control parent scroll
        localScroll.addEventListener('scroll', syncToParent);

        return () => {
            parentScrollContainer.removeEventListener('scroll', syncFromParent);
            localScroll.removeEventListener('scroll', syncToParent);
        };
    }, [scrollContainerRef]);

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50">
            {/* Detail Table */}
            <div className="overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800/80">
                            <th className="w-[140px] border-r border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">
                                Hour Type
                            </th>
                            <th className="border-b border-slate-200 p-0 dark:border-slate-700">
                                {/* Scrollable week headers - synced */}
                                <div ref={localScrollRef} className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                                    <div className="flex" style={{ minWidth: weeks.length * WEEK_COL_WIDTH }}>
                                        {weeks.map((week, idx) => (
                                            <div
                                                key={week.key}
                                                className={`flex flex-col items-center justify-center py-2 text-center ${
                                                    idx < weeks.length - 1 ? 'border-r border-slate-200 dark:border-slate-700' : ''
                                                }`}
                                                style={{ width: WEEK_COL_WIDTH, minWidth: WEEK_COL_WIDTH }}
                                            >
                                                <span className="text-[10px] text-slate-400 uppercase dark:text-slate-500">W.E</span>
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{week.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </th>
                            <th className="w-[100px] border-b border-l border-slate-200 px-3 py-2 text-center text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-700 dark:text-slate-400">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {hourRows.map((row, rowIdx) => (
                            <tr key={row.type} className={rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-800/30' : 'bg-slate-50 dark:bg-slate-800/60'}>
                                {/* Row Label */}
                                <td className="border-r border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${row.colorClass}`} />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{row.label}</span>
                                    </div>
                                </td>

                                {/* Week Cells - Scrollable, synced with header */}
                                <td className="border-b border-slate-200 p-0 dark:border-slate-700">
                                    <div
                                        className="overflow-x-auto"
                                        style={{ scrollbarWidth: 'none' }}
                                        onScroll={(e) => {
                                            // Sync all scroll containers in this detail panel
                                            const scrollLeft = e.currentTarget.scrollLeft;
                                            if (localScrollRef.current) {
                                                localScrollRef.current.scrollLeft = scrollLeft;
                                            }
                                            if (scrollContainerRef?.current) {
                                                scrollContainerRef.current.scrollLeft = scrollLeft;
                                            }
                                        }}
                                    >
                                        <div className="flex" style={{ minWidth: weeks.length * WEEK_COL_WIDTH }}>
                                            {weeks.map((week, idx) => (
                                                <div
                                                    key={week.key}
                                                    className={`flex items-center justify-center py-1.5 ${
                                                        idx < weeks.length - 1 ? 'border-r border-slate-200/50 dark:border-slate-700/50' : ''
                                                    }`}
                                                    style={{ width: WEEK_COL_WIDTH, minWidth: WEEK_COL_WIDTH }}
                                                >
                                                    {row.editable && !isEditingLocked ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step={row.type === 'ordinary' ? hoursPerWeek : 1}
                                                            value={row.values[week.key] || 0}
                                                            onChange={(e) => handleCellChange(row.type, week.key, e.target.value)}
                                                            className="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-700 transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:focus:bg-slate-600"
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">
                                                            {row.values[week.key] || 0}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </td>

                                {/* Total */}
                                <td className="border-b border-l border-slate-200 px-3 py-2 text-center dark:border-slate-700">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {calculateTotal(row.values).toLocaleString()}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
