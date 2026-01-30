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

interface StatusBannersProps {
    savedForecast: SavedForecast | null;
    hasConfiguredTemplates: boolean;
    flash?: { success?: string; error?: string };
    settingsOpen: boolean;
}

export const StatusBanners = ({
    savedForecast,
    hasConfiguredTemplates,
    flash,
    settingsOpen,
}: StatusBannersProps) => {
    return (
        <>
            {/* Rejection reason display */}
            {savedForecast?.status === 'rejected' && savedForecast.rejection_reason && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                    <h3 className="font-medium text-red-800 dark:text-red-200">Rejection Reason</h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">{savedForecast.rejection_reason}</p>
                </div>
            )}

            {/* Approval info display */}
            {savedForecast?.status === 'approved' && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                    <p className="text-sm text-green-700 dark:text-green-300">
                        Approved by {savedForecast.approved_by} on {savedForecast.approved_at}
                    </p>
                </div>
            )}

            {/* Submitted info display */}
            {savedForecast?.status === 'submitted' && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        Submitted by {savedForecast.submitted_by} on {savedForecast.submitted_at} - Awaiting approval
                    </p>
                </div>
            )}

            {/* Flash messages outside dialog */}
            {flash?.success && !settingsOpen && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    {flash.success}
                </div>
            )}

            {/* Empty state when no templates configured */}
            {!hasConfiguredTemplates && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                    <h3 className="font-medium text-amber-800 dark:text-amber-200">No Pay Rate Templates Configured</h3>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                        Click "Configure Templates" above to add KeyPay Pay Rate Templates for labour forecasting.
                    </p>
                </div>
            )}
        </>
    );
};
