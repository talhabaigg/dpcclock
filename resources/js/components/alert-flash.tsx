import { AlertCircleIcon } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';

const SuccessAlertFlash = ({ message }: { message: string }) => {
    useEffect(() => {
        if (!message) return;
        toast.success(message);
    }, [message]);
    return null;
};

const ErrorAlertFlash = ({ error }: { error: { message: string; response?: string } }) => {
    return (
        <Alert
            variant="destructive"
            className="m-2 mx-auto mt-1 max-w-96 border-red-700 p-2 text-sm sm:mx-2 sm:max-w-2xl"
        >
            <AlertCircleIcon />
            {error.message && <AlertDescription className="whitespace-pre-wrap">{error.message}</AlertDescription>}
            {error.response && <AlertDescription className="whitespace-pre-wrap">{error.response}</AlertDescription>}
        </Alert>
    );
};

export { ErrorAlertFlash, SuccessAlertFlash };
