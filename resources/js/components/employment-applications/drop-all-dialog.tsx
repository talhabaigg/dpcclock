import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DropAllDialog({ open, onOpenChange }: Props) {
    const [dropping, setDropping] = useState(false);

    const dropAll = () => {
        setDropping(true);
        router.delete('/employment-applications/drop-all', {
            onFinish: () => {
                setDropping(false);
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete All Enquiries</DialogTitle>
                    <DialogDescription>
                        This will permanently delete all employment enquiries. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button variant="destructive" disabled={dropping} onClick={dropAll}>
                        {dropping ? 'Deleting...' : 'Delete All'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
