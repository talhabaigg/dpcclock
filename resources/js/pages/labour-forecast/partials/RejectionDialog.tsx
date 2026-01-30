/**
 * Rejection Dialog Component
 *
 * PURPOSE:
 * Allows approvers to reject a submitted labour forecast with a reason.
 * The rejection reason is recorded and displayed to the submitter.
 *
 * WORKFLOW:
 * This dialog is shown when an approver clicks "Reject" on a submitted forecast.
 * After rejection, the forecast status changes to "rejected" and the submitter
 * is notified with the provided reason.
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 *
 * PROPS:
 * - open: boolean - Controls dialog visibility
 * - onOpenChange: (open: boolean) => void - Callback when dialog state changes
 * - onReject: (reason: string) => void - Callback to execute rejection
 * - isSubmitting: boolean - Whether a rejection is in progress
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RejectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onReject: (reason: string) => void;
    isSubmitting: boolean;
}

export const RejectionDialog = ({
    open,
    onOpenChange,
    onReject,
    isSubmitting,
}: RejectionDialogProps) => {
    const [rejectionReason, setRejectionReason] = useState('');

    // Reset reason when dialog closes
    useEffect(() => {
        if (!open) {
            setRejectionReason('');
        }
    }, [open]);

    const handleReject = () => {
        if (!rejectionReason.trim()) return;
        onReject(rejectionReason);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <X className="h-5 w-5" />
                        Reject Labour Forecast
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Please provide a reason for rejecting this labour forecast. The submitter will be notified.
                    </p>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter rejection reason..."
                        className="min-h-[100px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={isSubmitting || !rejectionReason.trim()}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Reject Forecast
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
