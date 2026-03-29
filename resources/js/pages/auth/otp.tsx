import { Head, router, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
type OtpForm = {
    otp: string;
    remember: boolean;
};

interface OtpProps {
    status?: string;
}

export default function Otp({ status }: OtpProps) {
    const [resending, setResending] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm<Required<OtpForm>>({
        otp: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('otp.verify'), {
            onFinish: () => reset('otp'),
        });
    };

    const resendOtp = () => {
        setResending(true);
        router.post(route('otp.resend'), {}, {
            onFinish: () => setResending(false),
        });
    };

    return (
        <AuthLayout
            title="Enter One-Time-Password"
            description="A 6-digit OTP has been sent to your email. Please enter it below to verify your account."
        >
            <Head title="OTP verification" />

            <form className="-mt-5 flex flex-col justify-between" onSubmit={submit}>
                <div className="grid gap-4">
                    <div className="mx-auto grid gap-2">
                        <div className="flex">
                            <InputOTP maxLength={6} onChange={(value) => setData('otp', value)} value={data.otp} tabIndex={2}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>

                        <InputError message={errors.otp} />
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="remember"
                            name="remember"
                            checked={data.remember}
                            onClick={() => setData('remember', !data.remember)}
                            tabIndex={3}
                        />
                        <Label htmlFor="remember">Trust this device for 30 days</Label>
                    </div>

                    <Button type="submit" className="mt-4 w-full" tabIndex={4} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Verify
                    </Button>

                    <div className="text-center">
                        <Button
                            type="button"
                            variant="link"
                            className="text-muted-foreground text-sm"
                            onClick={resendOtp}
                            disabled={resending}
                        >
                            {resending ? 'Sending...' : "Didn't receive the code? Resend"}
                        </Button>
                    </div>
                </div>
            </form>

            {status && <div className="mb-4 text-center text-sm font-medium text-green-600">{status}</div>}
        </AuthLayout>
    );
}
