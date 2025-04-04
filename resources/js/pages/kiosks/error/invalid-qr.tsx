import { AlertCircle } from 'lucide-react';

export default function ErrorPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
            <div className="flex max-w-sm flex-col items-center rounded-2xl bg-white p-6 text-center shadow-lg">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <h1 className="mt-4 text-xl font-bold">Oops! Your QR code expired.</h1>
                <p className="mt-2 text-gray-600">Please scan QR from the kiosk.</p>
                {/* <Button className="mt-4" onClick={() => navigate('/')}>
                    Go Home
                </Button> */}
            </div>
        </div>
    );
}
