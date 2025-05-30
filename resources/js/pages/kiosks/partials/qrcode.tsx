import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useState } from 'react';

interface KioskTokenDialogProps {
    kioskId: number;
}

const KioskTokenDialog: React.FC<KioskTokenDialogProps> = ({ kioskId }) => {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false); // track dialog open state

    const fetchToken = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/retrieve-kiosk-token');
            const newToken = response.data.token;

            // Only update if token has changed
            if (newToken !== token) {
                setToken(newToken);
            }
        } catch (error) {
            console.error('Error fetching token:', error);
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const generateKioskUrl = (token: string | null, kioskId: number) => {
        if (!token) return '';
        return `${window.location.origin}/kiosks/${kioskId}/validate-token?token=${token}`;
    };

    // Handle polling when dialog is open
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (open) {
            fetchToken(); // fetch immediately on open
            interval = setInterval(() => {
                fetchToken();
            }, 5000); // every 10 seconds
        }

        return () => clearInterval(interval); // cleanup when closed
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="btn btn-primary">Show QR</Button>
            </DialogTrigger>

            <DialogContent className="dialog-content flex flex-col items-center justify-center">
                <DialogTitle>SCAN QR CODE TO LOGIN</DialogTitle>

                {loading ? (
                    <DialogDescription>Updating...</DialogDescription>
                ) : token ? (
                    <div className="qr-code-container flex items-center justify-center">
                        <QRCodeSVG value={generateKioskUrl(token, kioskId)} size={256} />
                    </div>
                ) : (
                    <DialogDescription>You don't have permission to retrieve the QR code.</DialogDescription>
                )}

                <div className="mt-4 flex w-full justify-center">
                    {token && (
                        <a
                            className="text-center text-xs break-all text-blue-600 underline"
                            href={generateKioskUrl(token, kioskId)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {generateKioskUrl(token, kioskId)}
                        </a>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default KioskTokenDialog;
