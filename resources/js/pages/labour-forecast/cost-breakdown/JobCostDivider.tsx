/**
 * JobCostDivider Component
 *
 * PURPOSE:
 * Renders a dashed horizontal divider with a centered label, used to
 * visually separate job-costed from non-job-costed cost items.
 *
 * USED BY:
 * - LeaveSection (for "NOT JOB COSTED" / "JOB COSTED" separators)
 */

export interface JobCostDividerProps {
    /** Text to display in the center of the divider */
    label: string;
}

export const JobCostDivider = ({ label }: JobCostDividerProps) => (
    <div className="my-3 flex items-center gap-2">
        <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-600" />
    </div>
);
