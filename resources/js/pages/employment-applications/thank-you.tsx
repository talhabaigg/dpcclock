import { Card, CardContent } from '@/components/ui/card';
import { CheckIcon } from 'lucide-react';

export default function ThankYou() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
            <div className="flex w-full max-w-2xl flex-col items-center gap-6">
                <Card className="w-full rounded-xl">
                    <CardContent className="flex flex-col items-center gap-4 py-16">
                        <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-full">
                            <CheckIcon className="size-8" />
                        </div>
                        <h2 className="text-2xl font-semibold">Application Submitted</h2>
                        <p className="text-muted-foreground text-center">
                            Thank you for your application. We will review it and get back to you shortly.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
