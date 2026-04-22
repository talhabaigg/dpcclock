/**
 * Status Banners Component
 *
 * PURPOSE:
 * Displays informational banners based on the forecast's workflow status.
 * Shows relevant information for rejected, approved, submitted, or empty states.
 *
 * BANNER TYPES:
 * - Rejection banner: Shows rejection reason (red)
 * - Approval banner: Shows who approved and when (green)
 * - Submitted banner: Shows who submitted and when, awaiting approval (blue)
 * - Empty state banner: Prompts to configure templates (amber)
 * - Flash success: Shows success messages (green)
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import type { SavedForecast } from '../types';
import { formatMonthDisplay } from './utils';

interface StatusBannersProps {
    savedForecast: SavedForecast | null;
    selectedMonth: string;
    hasConfiguredTemplates: boolean;
    flash?: { success?: string; error?: string };
    settingsOpen: boolean;
}

export const StatusBanners = ({ savedForecast, selectedMonth, hasConfiguredTemplates, flash, settingsOpen }: StatusBannersProps) => {
    const monthLabel = formatMonthDisplay(selectedMonth);
    const bannerClass = 'mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300';

    return (
        <>
            {/* Rejection reason display */}
            {savedForecast?.status === 'rejected' && savedForecast.rejection_reason && (
                <div className={bannerClass}>
                    <span className="font-medium text-slate-900 dark:text-slate-100">Rejected.</span> {savedForecast.rejection_reason}
                </div>
            )}

            {/* Approval info display */}
            {savedForecast?.status === 'approved' && (
                <div className={bannerClass}>
                    Approved by {savedForecast.approved_by} on {savedForecast.approved_at}.
                </div>
            )}

            {/* Submitted info display */}
            {savedForecast?.status === 'submitted' && (
                <div className={bannerClass}>
                    Submitted by {savedForecast.submitted_by} on {savedForecast.submitted_at}. Awaiting approval.
                </div>
            )}

            {/* Helpful recovery state when the selected month has no saved forecast */}
            {!savedForecast && hasConfiguredTemplates && (
                <div className={bannerClass}>
                    No saved forecast for {monthLabel}. Start entering headcount, then save to create a draft.
                </div>
            )}

            {/* Flash messages outside dialog */}
            {flash?.success && !settingsOpen && (
                <div className={bannerClass}>{flash.success}</div>
            )}

            {flash?.error && !settingsOpen && (
                <div className={bannerClass}>{flash.error}</div>
            )}

            {/* Empty state when no templates configured */}
            {!hasConfiguredTemplates && (
                <div className={bannerClass}>
                    No pay rate templates configured. Use Configure Templates to add them.
                </div>
            )}
        </>
    );
};
