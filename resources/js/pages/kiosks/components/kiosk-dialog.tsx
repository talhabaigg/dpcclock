import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface DialogBoxProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children?: React.ReactNode;
    variant?: 'default' | 'success' | 'error' | 'loading';
}

const KioskDialogBox: React.FC<DialogBoxProps> = ({ isOpen, onClose, title, description, children, variant = 'default' }) => {
    const icons = {
        default: <AlertCircle className="h-16 w-16 text-primary" />,
        success: <CheckCircle2 className="h-16 w-16 text-emerald-500" />,
        error: <XCircle className="h-16 w-16 text-destructive" />,
        loading: <Loader2 className="h-16 w-16 animate-spin text-primary" />,
    };

    const titleColors = {
        default: 'text-foreground',
        success: 'text-emerald-600 dark:text-emerald-400',
        error: 'text-destructive',
        loading: 'text-foreground',
    };

    const bgColors = {
        default: 'bg-primary/5',
        success: 'bg-emerald-500/10',
        error: 'bg-destructive/10',
        loading: 'bg-primary/5',
    };

    return (
        <Dialog open={isOpen} onOpenChange={variant === 'loading' ? undefined : onClose}>
            <DialogContent
                className={cn(
                    'max-w-sm gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-2xl',
                    'touch-manipulation',
                )}
                hideCloseButton={variant === 'loading'}
            >
                {/* Icon Section with Background */}
                <div className={cn('flex items-center justify-center py-8', bgColors[variant])}>
                    <div className={cn(
                        'flex h-24 w-24 items-center justify-center rounded-full',
                        variant === 'error' && 'bg-destructive/10',
                        variant === 'success' && 'bg-emerald-500/10',
                        variant === 'default' && 'bg-primary/10',
                        variant === 'loading' && 'bg-primary/10',
                    )}>
                        {icons[variant]}
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-col items-center px-6 pb-6 pt-4">
                    <DialogHeader className="w-full space-y-2 text-center">
                        <DialogTitle className={cn('text-xl font-bold', titleColors[variant])}>
                            {title}
                        </DialogTitle>
                        {description && (
                            <DialogDescription className="text-base text-muted-foreground">
                                {description}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {/* Additional Content */}
                    {children && (
                        <div className="mt-4 w-full text-center text-muted-foreground">
                            {children}
                        </div>
                    )}
                </div>

                {/* Action Button */}
                {variant !== 'loading' && (
                    <div className="border-t bg-muted/30">
                        <Button
                            onClick={onClose}
                            variant="ghost"
                            className={cn(
                                'h-14 w-full rounded-none text-base font-semibold',
                                'touch-manipulation transition-colors',
                                'hover:bg-muted/50',
                                variant === 'error' && 'text-destructive hover:text-destructive',
                                variant === 'success' && 'text-emerald-600 hover:text-emerald-600',
                            )}
                        >
                            OK
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default KioskDialogBox;
