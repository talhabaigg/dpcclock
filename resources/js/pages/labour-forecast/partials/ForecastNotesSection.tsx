/**
 * Forecast Notes Section Component
 *
 * PURPOSE:
 * Provides an expandable section for adding notes to a labour forecast.
 * Notes can include assumptions, risks, or information for reviewers.
 *
 * FEATURES:
 * - Collapsible section to save space when not in use
 * - Preview of notes when collapsed
 * - Disabled when forecast is locked (submitted/approved/rejected)
 * - Notes are saved along with the forecast data
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

interface ForecastNotesSectionProps {
    notes: string;
    onNotesChange: (notes: string) => void;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    isEditingLocked: boolean;
}

export const ForecastNotesSection = ({
    notes,
    onNotesChange,
    expanded,
    onExpandedChange,
    isEditingLocked,
}: ForecastNotesSectionProps) => {
    return (
        <div className="mb-4">
            <div
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
            >
                <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2"
                    onClick={() => onExpandedChange(!expanded)}
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Forecast Notes
                        </span>
                        {notes && !expanded && (
                            <span className="max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
                                - {notes.substring(0, 60)}{notes.length > 60 ? '...' : ''}
                            </span>
                        )}
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    )}
                </button>

                {expanded && (
                    <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                        <textarea
                            value={notes}
                            onChange={(e) => onNotesChange(e.target.value)}
                            placeholder="Add notes about this forecast (key assumptions, risks, notes for reviewers...)"
                            className="min-h-[80px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                            disabled={isEditingLocked}
                        />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {isEditingLocked ? 'Forecast is locked - cannot edit notes' : 'Notes are saved when you click Save'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
