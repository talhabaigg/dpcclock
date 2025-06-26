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
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';

interface GenerateTimesheetsButtonProps {
    kioskId: number;
}

const GenerateTimesheetsButton = ({ kioskId }: GenerateTimesheetsButtonProps) => {
    return (
        <AlertDialog>
            <AlertDialogTrigger>
                {' '}
                <Button>Generate</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmation</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will generate timesheets for all employees from this kiosk based on today's events. Are you sure you want to
                        proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Link href={`/${kioskId}/timesheet-events/generate`}>
                        <AlertDialogAction> Generate</AlertDialogAction>
                    </Link>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default GenerateTimesheetsButton;
