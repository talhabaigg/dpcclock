import { AlertCircleIcon, CircleCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const SuccessAlertFlash = ({ message }: { message: string }) => {
    return (
        <Alert
            variant="default"
            className="m-2 mx-auto mt-1 max-w-96 items-center justify-start gap-2 border-green-700 p-2 text-sm sm:mx-2 sm:max-w-2xl sm:flex-row md:justify-between"
        >
            <CircleCheck color="#388E3C " />
            <AlertTitle className="mt-1 text-green-700">{message}</AlertTitle>
        </Alert>
    );
};

const ErrorAlertFlash = ({ error }: { error: { message: string; response?: string } }) => {
    return (
        <Alert
            variant="destructive"
            className="m-2 mx-auto mt-1 max-w-96 justify-start gap-2 border-red-700 p-2 text-sm sm:mx-2 sm:max-w-2xl sm:flex-row md:justify-between"
        >
            <AlertCircleIcon />
            {error.message && <AlertDescription className="whitespace-pre-wrap">{error.message}</AlertDescription>}
            {error.response && <AlertDescription className="whitespace-pre-wrap">{error.response}</AlertDescription>}
        </Alert>
    );
};

export { ErrorAlertFlash, SuccessAlertFlash };
