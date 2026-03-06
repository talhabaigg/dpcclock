import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Database } from 'lucide-react';
import SyncManager from './sync-manager';

type SyncManagerDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function SyncManagerDialog({ open, onOpenChange }: SyncManagerDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Data Sync Manager
                    </DialogTitle>
                    <DialogDescription>Select which data sources to sync from Premier.</DialogDescription>
                </DialogHeader>
                {open && <SyncManager />}
            </DialogContent>
        </Dialog>
    );
}
