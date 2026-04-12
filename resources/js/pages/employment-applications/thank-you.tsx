import { Head } from '@inertiajs/react';
import { CheckIcon } from 'lucide-react';

export default function ThankYou() {
    return (
        <>
        <Head title="Thank You" />
        <div className="flex min-h-svh flex-col items-center justify-center bg-white px-4 py-12 font-[system-ui,_-apple-system,_sans-serif]">
            <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-[#2e6da4] text-white">
                    <CheckIcon className="size-8" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">Application Submitted</h2>
                <p className="text-sm leading-relaxed text-gray-500">
                    Thank you for your application. We will review it and get back to you shortly.
                </p>
            </div>
        </div>
        </>
    );
}
