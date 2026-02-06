import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { Copy, ExternalLink, Loader2, QrCode, ShieldAlert } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface KioskTokenDialogProps {
    kioskId: number;
}

const KioskTokenDialog: React.FC<KioskTokenDialogProps> = ({ kioskId }) => {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchToken = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`/retrieve-kiosk-token?kioskId=${kioskId}`);
            const newToken = response.data.token;

            if (newToken !== token) {
                setToken(newToken);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch token');
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const generateKioskUrl = (token: string | null, kioskId: number) => {
        if (!token) return '';
        return `${window.location.origin}/kiosks/${kioskId}/validate-token?token=${token}`;
    };

    const copyToClipboard = () => {
        const url = generateKioskUrl(token, kioskId);
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (open) {
            fetchToken();
            interval = setInterval(() => {
                fetchToken();
            }, 5000);
        }

        return () => clearInterval(interval);
    }, [open]);

    const kioskUrl = generateKioskUrl(token, kioskId);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <QrCode className="h-4 w-4" />
                    <span className="hidden sm:inline">Show QR</span>
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-center">
                    <DialogTitle className="flex items-center justify-center gap-2">
                        <QrCode className="text-primary h-5 w-5" />
                        Scan to Login
                    </DialogTitle>
                    <DialogDescription>Scan this QR code with your device to access this kiosk</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-4">
                    {loading && !token ? (
                        <div className="bg-muted/30 flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-xl border">
                            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                            <p className="text-muted-foreground text-sm">Loading QR code...</p>
                        </div>
                    ) : error || !token ? (
                        <div className="border-destructive/30 bg-destructive/5 flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-xl border">
                            <ShieldAlert className="text-destructive/60 h-10 w-10" />
                            <p className="text-destructive text-center text-sm">{error || "You don't have permission to retrieve the QR code."}</p>
                        </div>
                    ) : (
                        <>
                            {/* QR Code Container */}
                            <div
                                className={cn(
                                    'border-primary/20 relative rounded-xl border-2 bg-white p-4',
                                    'shadow-primary/5 shadow-lg',
                                    loading && 'opacity-60',
                                )}
                            >
                                <QRCodeSVG value={kioskUrl} size={224} level="M" includeMargin={false} />
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80">
                                        <Loader2 className="text-primary h-6 w-6 animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* URL & Actions */}
                            <div className="w-full space-y-3">
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-muted-foreground text-center text-xs break-all">{kioskUrl}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={copyToClipboard}>
                                        <Copy className="h-4 w-4" />
                                        Copy Link
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1 gap-2" asChild>
                                        <a href={kioskUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                            Open Link
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default KioskTokenDialog;
