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
import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useState } from 'react';

interface Props {
    kioskId: number;
    employeeId: number;
    employeeName: string;
}

const RemoveEmployeeButton = ({ kioskId, employeeId, employeeName }: Props) => {
    const [removing, setRemoving] = useState(false);

    const handleRemove = () => {
        setRemoving(true);
        router.delete(route('kiosks.removeEmployee', { kiosk: kioskId, employee: employeeId }), {
            preserveScroll: true,
            onFinish: () => setRemoving(false),
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger
                title="Remove employee from kiosk"
                aria-label={`Remove ${employeeName} from kiosk`}
                disabled={removing}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950"
            >
                <X className="h-4 w-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove {employeeName} from this kiosk?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This only removes them from the kiosk in Portal. Employment Hero is not affected — if the kiosk is synced again, they will
                        reappear.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemove} className="bg-red-600 hover:bg-red-700">
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default RemoveEmployeeButton;
