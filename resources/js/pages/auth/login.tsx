import { Head, useForm, router } from '@inertiajs/react';
import { LoaderCircle, Fingerprint } from 'lucide-react';
import { FormEventHandler, useState, useEffect } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

type LoginForm = {
    email: string;
    password: string;
    remember: boolean;
};

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const [passkeysSupported, setPasskeysSupported] = useState(false);
    const [isAuthenticatingWithPasskey, setIsAuthenticatingWithPasskey] = useState(false);
    const [passkeyError, setPasskeyError] = useState<string | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm<Required<LoginForm>>({
        email: '',
        password: '',
        remember: false,
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && window.browserSupportsWebAuthn) {
            setPasskeysSupported(window.browserSupportsWebAuthn());
        }
    }, []);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const handlePasskeyLogin = async () => {
        setPasskeyError(null);
        setIsAuthenticatingWithPasskey(true);

        try {
            // Fetch authentication options from the server
            const response = await fetch(route('passkeys.authentication_options'));
            const options = await response.json();

            // Start the authentication process with the browser
            const authenticationResponse = await window.startAuthentication({ optionsJSON: options });

            // Send the authentication response to the server
            router.post(
                route('passkeys.login'),
                {
                    start_authentication_response: JSON.stringify(authenticationResponse),
                },
                {
                    onError: (errors) => {
                        setPasskeyError(Object.values(errors).flat().join(' ') || 'Passkey authentication failed.');
                    },
                    onFinish: () => {
                        setIsAuthenticatingWithPasskey(false);
                    },
                }
            );
        } catch (err: any) {
            console.error('Passkey authentication failed:', err);
            setPasskeyError(err?.message || 'Passkey authentication failed. Please try again.');
            setIsAuthenticatingWithPasskey(false);
        }
    };

    return (
        <AuthLayout title="Log in to your account" description="Enter your email and password below to log in">
            <Head title="Log in" />

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="email@example.com"
                        />
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">Password</Label>
                            {canResetPassword && (
                                <TextLink href={route('password.request')} className="ml-auto text-sm" tabIndex={5}>
                                    Forgot password?
                                </TextLink>
                            )}
                        </div>
                        <Input
                            id="password"
                            type="password"
                            required
                            tabIndex={2}
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Password"
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="remember"
                            name="remember"
                            checked={data.remember}
                            onClick={() => setData('remember', !data.remember)}
                            tabIndex={3}
                        />
                        <Label htmlFor="remember">Remember me</Label>
                    </div>

                    <Button type="submit" className="mt-4 w-full" tabIndex={4} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Log in
                    </Button>

                    {passkeysSupported && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background text-muted-foreground px-2">Or</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={handlePasskeyLogin}
                                disabled={isAuthenticatingWithPasskey}
                            >
                                {isAuthenticatingWithPasskey ? (
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Fingerprint className="mr-2 h-4 w-4" />
                                )}
                                Sign in with passkey
                            </Button>

                            {passkeyError && (
                                <p className="text-sm text-red-500 text-center">{passkeyError}</p>
                            )}
                        </>
                    )}
                </div>

                <div className="text-muted-foreground text-center text-sm">
                    Don't have an account?{' '}
                    <TextLink href={route('register')} tabIndex={5}>
                        Sign up
                    </TextLink>
                </div>
            </form>

            {status && <div className="mb-4 text-center text-sm font-medium text-green-600">{status}</div>}
        </AuthLayout>
    );
}
