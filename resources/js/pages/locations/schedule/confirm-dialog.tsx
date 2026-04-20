import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    /** When set, user must type this exact string for the confirm button to enable. */
    requireTyping?: string;
    typingLabel?: string;
    onConfirm: () => void;
}

export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    requireTyping,
    typingLabel,
    onConfirm,
}: ConfirmDialogProps) {
    const [typed, setTyped] = useState('');

    useEffect(() => {
        if (!open) setTyped('');
    }, [open]);

    const canConfirm = !requireTyping || typed.trim() === requireTyping;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="text-muted-foreground space-y-2 text-sm">{description}</div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {requireTyping && (
                    <div className="grid gap-2 py-1">
                        <Label htmlFor="confirm-typed" className="text-xs">
                            {typingLabel ?? `Type "${requireTyping}" to confirm`}
                        </Label>
                        <Input
                            id="confirm-typed"
                            autoFocus
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            placeholder={requireTyping}
                            className="h-8"
                        />
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={!canConfirm}
                        onClick={onConfirm}
                        className={cn(destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
