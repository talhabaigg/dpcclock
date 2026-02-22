import { useCallback, useRef, useState } from 'react';
import type { ConfirmDialogProps } from '@/components/confirm-dialog';

type ConfirmOptions = {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'destructive';
};

type ConfirmResult = {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    dialogProps: Omit<ConfirmDialogProps, 'loading'>;
};

export function useConfirm(): ConfirmResult {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: '',
        description: '',
    });
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        setOptions(opts);
        setOpen(true);
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const handleOpenChange = useCallback((value: boolean) => {
        if (!value) {
            resolveRef.current?.(false);
            resolveRef.current = null;
        }
        setOpen(value);
    }, []);

    const handleConfirm = useCallback(() => {
        resolveRef.current?.(true);
        resolveRef.current = null;
        setOpen(false);
    }, []);

    return {
        confirm,
        dialogProps: {
            open,
            onOpenChange: handleOpenChange,
            title: options.title,
            description: options.description,
            confirmLabel: options.confirmLabel,
            cancelLabel: options.cancelLabel,
            variant: options.variant,
            onConfirm: handleConfirm,
        },
    };
}
