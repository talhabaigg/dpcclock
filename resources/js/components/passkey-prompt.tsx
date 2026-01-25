import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Fingerprint, Shield, Lock, Zap, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PageProps {
    passkeyPrompt: {
        hasPasskeys: boolean;
        dismissed: boolean;
    } | null;
    [key: string]: unknown;
}

export default function PasskeyPrompt() {
    const { passkeyPrompt } = usePage<PageProps>().props;
    const [isOpen, setIsOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [passkeysSupported, setPasskeysSupported] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Check if browser supports passkeys
        if (typeof window !== 'undefined' && window.browserSupportsWebAuthn) {
            setPasskeysSupported(window.browserSupportsWebAuthn());
        }
    }, []);

    useEffect(() => {
        // Check if dismissed for this session
        const dismissedThisSession = sessionStorage.getItem('passkey-prompt-dismissed') === 'true';

        // Show prompt if:
        // - User is logged in
        // - Browser supports passkeys
        // - User doesn't have passkeys set up
        // - User hasn't dismissed the prompt permanently
        // - User hasn't dismissed for this session
        if (
            passkeyPrompt &&
            passkeysSupported &&
            !passkeyPrompt.hasPasskeys &&
            !passkeyPrompt.dismissed &&
            !dismissedThisSession
        ) {
            // Small delay to let the page load first
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [passkeyPrompt, passkeysSupported]);

    const handleDismiss = () => {
        if (dontShowAgain) {
            router.post(route('passkeys.dismiss-prompt'), {}, {
                preserveState: true,
                preserveScroll: true,
            });
        } else {
            // Remember dismissal for this session only
            sessionStorage.setItem('passkey-prompt-dismissed', 'true');
        }
        setIsOpen(false);
    };

    const handleSetupPasskey = async () => {
        setError(null);
        setIsRegistering(true);

        try {
            // Fetch registration options from the server
            const response = await fetch(route('passkeys.generate-options'), {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                },
            });
            const options = await response.json();

            // Start the registration process with the browser
            const registrationResponse = await window.startRegistration({ optionsJSON: options });

            // Send the registration response to the server
            router.post(
                route('passkeys.store'),
                {
                    passkey: JSON.stringify(registrationResponse),
                    options: JSON.stringify(options),
                    name: 'My Passkey',
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setSuccess(true);
                        // Dismiss prompt permanently since they now have a passkey
                        router.post(route('passkeys.dismiss-prompt'), {}, {
                            preserveState: true,
                            preserveScroll: true,
                        });
                        // Close dialog after showing success
                        setTimeout(() => setIsOpen(false), 2000);
                    },
                    onError: (errors) => {
                        setError(Object.values(errors).flat().join(' ') || 'Failed to register passkey.');
                    },
                    onFinish: () => {
                        setIsRegistering(false);
                    },
                }
            );
        } catch (err: any) {
            console.error('Passkey registration failed:', err);
            setError(err?.message || 'Failed to register passkey. Please try again.');
            setIsRegistering(false);
        }
    };

    if (!passkeyPrompt || !passkeysSupported) {
        return null;
    }

    // Success state
    if (success) {
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <DialogTitle className="text-center">Passkey Created!</DialogTitle>
                        <DialogDescription className="text-center">
                            Your account is now more secure. You can sign in using your fingerprint, face, or device PIN.
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Fingerprint className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center">Secure your account with a Passkey</DialogTitle>
                    <DialogDescription className="text-center">
                        Passkeys are a more secure and convenient way to sign in.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">Phishing-resistant</p>
                            <p className="text-muted-foreground text-xs">
                                Passkeys only work on the real site, protecting you from fake login pages.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">No passwords to steal</p>
                            <p className="text-muted-foreground text-xs">
                                Your passkey uses encryption that never leaves your device.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">Fast and easy</p>
                            <p className="text-muted-foreground text-xs">
                                Sign in instantly with your fingerprint, face, or device PIN.
                            </p>
                        </div>
                    </div>
                </div>

                {error && (
                    <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <div className="flex items-center space-x-2 border-t pt-4">
                    <Checkbox
                        id="dont-show-again"
                        checked={dontShowAgain}
                        onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                    />
                    <Label htmlFor="dont-show-again" className="text-sm text-muted-foreground cursor-pointer">
                        Don't show this again
                    </Label>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                    <Button onClick={handleSetupPasskey} className="w-full" disabled={isRegistering}>
                        {isRegistering ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Fingerprint className="mr-2 h-4 w-4" />
                        )}
                        {isRegistering ? 'Setting up...' : 'Set up Passkey'}
                    </Button>
                    <Button variant="ghost" onClick={handleDismiss} className="w-full" disabled={isRegistering}>
                        Maybe later
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
