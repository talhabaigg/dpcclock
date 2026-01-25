import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Fingerprint, Trash2, Pencil, Plus, LoaderCircle, AlertCircle } from 'lucide-react';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Passkeys',
        href: '/settings/passkeys',
    },
];

interface Passkey {
    id: string;
    name: string;
    last_used_at: string | null;
    created_at: string;
}

interface PasskeysProps {
    passkeys: Passkey[];
}

export default function Passkeys({ passkeys }: PasskeysProps) {
    const [isAddingPasskey, setIsAddingPasskey] = useState(false);
    const [passkeysSupported, setPasskeysSupported] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editPasskey, setEditPasskey] = useState<Passkey | null>(null);
    const [editName, setEditName] = useState('');
    const [newPasskeyName, setNewPasskeyName] = useState('');

    // Check if passkeys are supported
    useState(() => {
        if (typeof window !== 'undefined' && window.browserSupportsWebAuthn) {
            setPasskeysSupported(window.browserSupportsWebAuthn());
        }
    });

    const handleAddPasskey = async () => {
        setError(null);
        setIsAddingPasskey(true);

        try {
            // Fetch registration options from the server (include credentials for session)
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
                    options: JSON.stringify(options),
                    passkey: JSON.stringify(registrationResponse),
                    name: newPasskeyName || undefined,
                },
                {
                    onSuccess: () => {
                        setNewPasskeyName('');
                    },
                    onError: (errors) => {
                        setError(Object.values(errors).flat().join(' '));
                    },
                    onFinish: () => {
                        setIsAddingPasskey(false);
                    },
                }
            );
        } catch (err: any) {
            console.error('Passkey registration failed:', err);
            setError(err?.message || 'Failed to register passkey. Please try again.');
            setIsAddingPasskey(false);
        }
    };

    const handleDeletePasskey = (id: string) => {
        router.delete(route('passkeys.destroy', { id }), {
            onSuccess: () => {
                setDeleteId(null);
            },
        });
    };

    const handleEditPasskey = () => {
        if (!editPasskey) return;

        router.put(
            route('passkeys.update', { id: editPasskey.id }),
            { name: editName },
            {
                onSuccess: () => {
                    setEditPasskey(null);
                    setEditName('');
                },
            }
        );
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Passkeys" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Passkeys"
                        description="Passkeys are a more secure alternative to passwords. Use your fingerprint, face, or device PIN to sign in."
                    />

                    {passkeysSupported === false && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Your browser does not support passkeys. Please use a modern browser like Chrome, Safari, Firefox, or Edge.
                            </AlertDescription>
                        </Alert>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Add Passkey Form */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <Label htmlFor="passkey-name">Passkey name (optional)</Label>
                                <Input
                                    id="passkey-name"
                                    type="text"
                                    value={newPasskeyName}
                                    onChange={(e) => setNewPasskeyName(e.target.value)}
                                    placeholder="e.g., MacBook Pro, iPhone"
                                    className="mt-1"
                                />
                            </div>
                            <Button
                                onClick={handleAddPasskey}
                                disabled={isAddingPasskey || passkeysSupported === false}
                            >
                                {isAddingPasskey ? (
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Plus className="mr-2 h-4 w-4" />
                                )}
                                Add passkey
                            </Button>
                        </div>
                    </div>

                    {/* Passkeys List */}
                    {passkeys.length > 0 ? (
                        <div className="divide-y rounded-md border">
                            {passkeys.map((passkey) => (
                                <div
                                    key={passkey.id}
                                    className="flex items-center justify-between p-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                                            <Fingerprint className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{passkey.name}</p>
                                            <p className="text-muted-foreground text-sm">
                                                Created: {formatDate(passkey.created_at)}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                Last used: {formatDate(passkey.last_used_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                setEditPasskey(passkey);
                                                setEditName(passkey.name);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteId(passkey.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center">
                            <Fingerprint className="mx-auto h-12 w-12 opacity-50" />
                            <p className="mt-4">No passkeys registered</p>
                            <p className="text-sm">Add a passkey to enable passwordless sign-in.</p>
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete passkey?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. You will no longer be able to sign in using this passkey.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteId && handleDeletePasskey(deleteId)}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Edit Name Dialog */}
                <Dialog open={!!editPasskey} onOpenChange={() => setEditPasskey(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit passkey name</DialogTitle>
                            <DialogDescription>
                                Give your passkey a memorable name to help you identify it.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditPasskey(null)}>
                                Cancel
                            </Button>
                            <Button onClick={handleEditPasskey}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </SettingsLayout>
        </AppLayout>
    );
}
