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

import { Badge } from '@/components/ui/badge';
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

    // Status badge variant
    const getStatusBadgeVariant = (): 'secondary' | 'default' | 'destructive' | 'outline' => {
        if (!savedForecast) return 'secondary';
        switch (savedForecast.status) {
            case 'draft':
                return 'secondary';
            case 'submitted':
                return 'default';
            case 'approved':
                return 'outline';
            case 'rejected':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    return (
        <div className="mb-4">
            {/* Toolbar Row */}
            <div className="flex flex-wrap items-center gap-2">
                {/* LEFT: Context — what am I viewing */}
                <div className="flex items-center gap-1 rounded-md border bg-card px-1 py-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center text-sm font-medium sm:min-w-[140px]">{formatMonthDisplay(selectedMonth)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateMonth('next')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {savedForecast && (
                    <Badge variant={getStatusBadgeVariant()}>
                        {savedForecast.status.charAt(0).toUpperCase() + savedForecast.status.slice(1)}
                    </Badge>
                )}
                {hasUnsavedChanges && <span className="text-xs text-muted-foreground">Unsaved</span>}

                {/* RIGHT: Actions — pushed to end */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {/* Secondary actions */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.get(route('labour-forecast.variance', { location: location.id }), { month: selectedMonth })}
                        title="View forecast vs actual variance report"
                    >
                        <BarChart3 className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Variance</span>
                    </Button>

                    <Button variant="outline" size="sm" onClick={onOpenSettings}>
                        <Settings className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">Configure</span>
                    </Button>

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

                    {/* Primary workflow actions (rightmost) */}
                    {savedForecast && savedForecast.status === 'submitted' && permissions.canApprove && (
                        <Button variant="destructive" size="sm" onClick={onOpenRejectDialog} disabled={isSubmitting}>
                            <X className="mr-1.5 h-4 w-4" />
                            <span className="hidden sm:inline">Reject</span>
                        </Button>
                    )}

                    {savedForecast && (savedForecast.status === 'approved' || savedForecast.status === 'rejected') && permissions.canApprove && (
                        <Button variant="outline" size="sm" onClick={onRevertToDraft} disabled={isSubmitting}>
                            <span className="hidden sm:inline">Revert to Draft</span>
                            <span className="sm:hidden">Revert</span>
                        </Button>
                    )}

                    {hasConfiguredTemplates && !isEditingLocked && (
                        <Button onClick={onSave} disabled={isSaving || !hasUnsavedChanges} size="sm">
                            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                        </Button>
                    )}

                    {savedForecast && savedForecast.status === 'draft' && permissions.canSubmit && (
                        <Button onClick={onSubmit} disabled={isSubmitting || hasUnsavedChanges} size="sm">
                            {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                            <span className="hidden sm:inline">Submit</span>
                        </Button>
                    )}

                    {savedForecast && savedForecast.status === 'submitted' && permissions.canApprove && (
                        <Button onClick={onApprove} disabled={isSubmitting} size="sm">
                            {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                            <span className="hidden sm:inline">Approve</span>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
