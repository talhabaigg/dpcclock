/**
 * Forecast Header Component
 *
 * PURPOSE:
 * Displays the header section of the labour forecast page including:
 * - Location name and job number
 * - Forecast status badge (draft/submitted/approved/rejected)
 * - Month navigation controls
 * - Action buttons (Save, Submit, Approve, Reject, Configure, Variance)
 *
 * WORKFLOW STATES:
 * - Draft: Can Save, Submit (if canSubmit), Configure
 * - Submitted: Can Approve/Reject (if canApprove)
 * - Approved: Can Revert to Draft (if canApprove)
 * - Rejected: Can Revert to Draft (if canApprove)
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { Button } from '@/components/ui/button';
import { router } from '@inertiajs/react';
import { BarChart3, Check, ChevronLeft, ChevronRight, Copy, Loader2, Save, Send, Settings, X } from 'lucide-react';
import type { SavedForecast } from '../types';
import { formatMonthDisplay } from './utils';

interface ForecastHeaderProps {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    selectedMonth: string;
    savedForecast: SavedForecast | null;
    permissions: {
        canSubmit: boolean;
        canApprove: boolean;
    };
    hasUnsavedChanges: boolean;
    hasConfiguredTemplates: boolean;
    // Saving state
    isSaving: boolean;
    onSave: () => void;
    // Copying state
    isCopying: boolean;
    onCopyFromPrevious: () => void;
    // Workflow state
    isSubmitting: boolean;
    onSubmit: () => void;
    onApprove: () => void;
    onOpenRejectDialog: () => void;
    onRevertToDraft: () => void;
    // Settings
    onOpenSettings: () => void;
}

export const ForecastHeader = ({
    location,
    selectedMonth,
    savedForecast,
    permissions,
    hasUnsavedChanges,
    hasConfiguredTemplates,
    isSaving,
    onSave,
    isCopying,
    onCopyFromPrevious,
    isSubmitting,
    onSubmit,
    onApprove,
    onOpenRejectDialog,
    onRevertToDraft,
    onOpenSettings,
}: ForecastHeaderProps) => {
    // Check if editing is allowed (only draft status)
    const isEditingLocked = savedForecast && savedForecast.status !== 'draft';

    // Month navigation handlers
    const navigateMonth = (direction: 'prev' | 'next') => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        router.get(route('labour-forecast.show', { location: location.id }), { month: newMonth }, { preserveScroll: true });
    };

    // Status badge color
    const getStatusBadgeClass = () => {
        if (!savedForecast) return '';
        switch (savedForecast.status) {
            case 'draft':
                return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
            case 'submitted':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case 'approved':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
            case 'rejected':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            default:
                return '';
        }
    };

    return (
        <div className="mb-4 space-y-3">
            {/* Title Row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-lg font-semibold sm:text-xl">{location.name}</h1>
                        {savedForecast && (
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass()}`}>
                                {savedForecast.status.charAt(0).toUpperCase() + savedForecast.status.slice(1)}
                            </span>
                        )}
                        {hasUnsavedChanges && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved</span>}
                    </div>
                    <p className="text-sm text-gray-500">Job: {location.job_number}</p>
                </div>

                {/* Month Navigation */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 dark:border-slate-700 dark:bg-slate-800">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center text-sm font-medium sm:min-w-[140px]">{formatMonthDisplay(selectedMonth)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Save Button */}
                {hasConfiguredTemplates && !isEditingLocked && (
                    <Button onClick={onSave} disabled={isSaving || !hasUnsavedChanges} size="sm" className="bg-green-600 hover:bg-green-700">
                        {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                        <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                    </Button>
                )}

                {/* Copy from Previous Month Button */}
                {hasConfiguredTemplates && !isEditingLocked && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCopyFromPrevious}
                        disabled={isCopying}
                        title="Copy headcount from last approved forecast for all project months"
                    >
                        {isCopying ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Copy className="mr-1.5 h-4 w-4" />}
                        <span className="hidden sm:inline">{isCopying ? 'Copying...' : 'Copy Previous'}</span>
                    </Button>
                )}

                {/* Workflow Buttons */}
                {savedForecast && savedForecast.status === 'draft' && permissions.canSubmit && (
                    <Button onClick={onSubmit} disabled={isSubmitting || hasUnsavedChanges} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                        <span className="hidden sm:inline">Submit</span>
                    </Button>
                )}

                {savedForecast && savedForecast.status === 'submitted' && permissions.canApprove && (
                    <>
                        <Button onClick={onApprove} disabled={isSubmitting} size="sm" className="bg-green-600 hover:bg-green-700">
                            {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                            <span className="hidden sm:inline">Approve</span>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={onOpenRejectDialog} disabled={isSubmitting}>
                            <X className="mr-1.5 h-4 w-4" />
                            <span className="hidden sm:inline">Reject</span>
                        </Button>
                    </>
                )}

                {savedForecast && (savedForecast.status === 'approved' || savedForecast.status === 'rejected') && permissions.canApprove && (
                    <Button variant="outline" size="sm" onClick={onRevertToDraft} disabled={isSubmitting}>
                        <span className="hidden sm:inline">Revert to Draft</span>
                        <span className="sm:hidden">Revert</span>
                    </Button>
                )}

                <Button variant="outline" size="sm" onClick={onOpenSettings}>
                    <Settings className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Configure</span>
                </Button>

                {/* Variance Report Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.get(route('labour-forecast.variance', { location: location.id }), { month: selectedMonth })}
                    title="View forecast vs actual variance report"
                >
                    <BarChart3 className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Variance</span>
                </Button>
            </div>
        </div>
    );
};
