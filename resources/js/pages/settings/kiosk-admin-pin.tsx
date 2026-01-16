import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Transition } from '@headlessui/react';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler, useRef } from 'react';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Kiosk Admin PIN settings',
        href: '/settings/kiosk-admin-pin',
    },
];

export default function KioskAdminPin() {
    const passwordInput = useRef<HTMLInputElement>(null);

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        new_pin: '',
    });

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('admin-kiosk-pin.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.new_pin) {
                    reset('new_pin');
                    passwordInput.current?.focus();
                }
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Update Kiosk Admin PIN"
                        description="Enter a 4 digit pin to be used on kiosk as admin to enable admin-mode."
                    />

                    <form onSubmit={updatePassword} className="space-y-6">
                        <div className="grid gap-2">
                            <Label htmlFor="new_pin">New PIN</Label>

                            {/* <Input
                                id="new_pin"
                                ref={passwordInput}
                                value={data.new_pin}
                                onChange={(e) => setData('new_pin', e.target.value)}
                                type="password"
                                className="mt-1 block w-full"
                                autoComplete="new-password"
                                placeholder="New PIN"
                            /> */}
                            <InputOTP maxLength={4} onChange={(value) => setData('new_pin', value)} value={data.new_pin}>
                                <InputOTPGroup typeof="password">
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>

                            <InputError message={errors.new_pin} />
                        </div>

                        <div className="flex items-center gap-4">
                            <Button disabled={processing}>Save PIN</Button>

                            <Transition
                                show={recentlySuccessful}
                                enter="transition ease-in-out"
                                enterFrom="opacity-0"
                                leave="transition ease-in-out"
                                leaveTo="opacity-0"
                            >
                                <p className="text-sm text-neutral-600">Saved</p>
                            </Transition>
                        </div>
                    </form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
