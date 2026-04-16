import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

interface PageProps {
    savedSignatureUrl: string | null;
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Settings', href: '/settings/profile' },
    { title: 'Signature', href: '/settings/signature' },
];

export default function SignatureSettings() {
    const { savedSignatureUrl } = usePage<PageProps>().props;

    const padRef = useRef<SignaturePad | null>(null);
    const [isDrawing, setIsDrawing] = useState(!savedSignatureUrl);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        // If the saved signature changes from null → url, exit drawing mode automatically.
        if (savedSignatureUrl && !saving) setIsDrawing(false);
         
    }, [savedSignatureUrl]);

    const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas) {
            padRef.current?.off();
            padRef.current = null;
            return;
        }
        if (padRef.current) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        padRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
    }, []);

    const clear = () => padRef.current?.clear();
    const undo = () => {
        const pad = padRef.current;
        if (!pad) return;
        const data = pad.toData();
        if (data.length > 0) {
            data.pop();
            pad.fromData(data);
        }
    };

    const save = () => {
        const pad = padRef.current;
        if (!pad || pad.isEmpty()) return;
        setSaving(true);
        const signatureData = pad.toDataURL('image/png');
        router.post(route('signature.store'), { signature_data: signatureData }, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        });
    };

    const remove = () => {
        if (!confirm('Remove your saved signature? You can always draw and save a new one.')) return;
        setDeleting(true);
        router.delete(route('signature.destroy'), {
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                setIsDrawing(true);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Signature" />
            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="My signature"
                        description="Draw your signature once, then reuse it when sending documents for signing. You can replace or remove it at any time."
                    />

                    {savedSignatureUrl && !isDrawing ? (
                        <div className="space-y-4">
                            <div className="rounded-md border bg-white p-4">
                                <img src={savedSignatureUrl} alt="Your saved signature" className="mx-auto max-h-40" />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsDrawing(true)}>
                                    Replace signature
                                </Button>
                                <Button variant="outline" className="text-destructive" onClick={remove} disabled={deleting}>
                                    {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Draw your signature</span>
                                <div className="flex gap-1">
                                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={undo}>
                                        <RotateCcw className="mr-1 h-3 w-3" />
                                        Undo
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clear}>
                                        <Trash2 className="mr-1 h-3 w-3" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                            <canvas
                                ref={attachCanvas}
                                className="h-40 w-full rounded-md border bg-white"
                                style={{ touchAction: 'none' }}
                            />
                            <div className="flex gap-2">
                                <Button onClick={save} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {savedSignatureUrl ? 'Replace signature' : 'Save signature'}
                                </Button>
                                {savedSignatureUrl && (
                                    <Button variant="outline" onClick={() => setIsDrawing(false)}>Cancel</Button>
                                )}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Your saved signature is stored privately on your profile. When you send a document, you can choose to use it or draw a fresh one.
                    </p>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
