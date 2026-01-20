import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';

interface ForgotPinLinkProps {
    eh_employee_id: number;
    eh_kiosk_id: string;
}

export default function ForgotPinLink({ eh_employee_id, eh_kiosk_id }: ForgotPinLinkProps) {
    const handleResetPin = () => {
        window.location.href = route('kiosk.auth.reset-pin', {
            employeeId: eh_employee_id,
            kiosk: eh_kiosk_id,
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex items-center gap-1.5 text-sm text-muted-foreground',
                        'transition-colors hover:text-primary',
                        'touch-manipulation',
                    )}
                >
                    <HelpCircle className="h-4 w-4" />
                    <span>Forgot your PIN?</span>
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm rounded-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset PIN</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will send a PIN reset link to your registered email address. Are you sure you want to continue?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 sm:gap-0">
                    <AlertDialogCancel className="touch-manipulation">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleResetPin}
                        className="touch-manipulation bg-primary hover:bg-primary/90"
                    >
                        Reset PIN
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
