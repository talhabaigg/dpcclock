import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { router } from '@inertiajs/react';
import { api } from '@/lib/api';
import { Check, Copy, Link2, Plus, Power, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

interface KioskDevice {
    id: number;
    device_name: string | null;
    is_active: boolean;
    last_seen_at: string | null;
    created_at: string;
}

interface RegisteredDevicesCardProps {
    kioskId: number;
    devices: KioskDevice[];
}

export default function RegisteredDevicesCard({ kioskId, devices }: RegisteredDevicesCardProps) {
    const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
    const [deviceName, setDeviceName] = useState('');
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!deviceName.trim()) return;
        setGenerating(true);

        try {
            const data = await api.post<{ url: string }>(route('kiosk-devices.generate-token', kioskId), {
                device_name: deviceName.trim(),
            });
            setGeneratedUrl(data.url);
        } catch {
            // Error handled by Inertia
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = async () => {
        if (!generatedUrl) return;
        await navigator.clipboard.writeText(generatedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCloseDialog = () => {
        setGenerateDialogOpen(false);
        setDeviceName('');
        setGeneratedUrl(null);
        setCopied(false);
    };

    const handleToggle = (deviceId: number) => {
        router.post(route('kiosk-devices.toggle', { kiosk: kioskId, device: deviceId }), {}, { preserveScroll: true });
    };

    const handleDelete = (deviceId: number) => {
        if (!confirm('Remove this device? It will be unlocked immediately.')) return;
        router.delete(route('kiosk-devices.destroy', { kiosk: kioskId, device: deviceId }), { preserveScroll: true });
    };

    const formatLastSeen = (dateStr: string | null) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <>
            <Card>
                <CardHeader className="border-b">
                    <CardTitle>Registered Devices</CardTitle>
                    <CardDescription>Lock a browser to this kiosk via a registration link.</CardDescription>
                    <CardAction>
                        <Button variant="outline" size="sm" onClick={() => setGenerateDialogOpen(true)}>
                            <Plus className="mr-1 h-4 w-4" />
                            Register Device
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent className="pt-4">
                    {devices.length === 0 && (
                        <p className="text-muted-foreground text-sm">No devices registered. Generate a registration link to lock a device to this kiosk.</p>
                    )}
                    {devices.length > 0 && (
                        <div className="space-y-3">
                            {devices.map((device) => (
                                <div key={device.id} className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-2 w-2 rounded-full ${device.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                        <div>
                                            <p className="text-sm font-medium">{device.device_name || 'Unnamed Device'}</p>
                                            <p className="text-muted-foreground text-xs">
                                                Last seen: {formatLastSeen(device.last_seen_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={device.is_active ? 'default' : 'secondary'}>
                                            {device.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleToggle(device.id)}
                                            title={device.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            <Power className={`h-4 w-4 ${device.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-700"
                                            onClick={() => handleDelete(device.id)}
                                            title="Remove device"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generate Registration Link Dialog */}
            <Dialog open={generateDialogOpen} onOpenChange={handleCloseDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Register a Device</DialogTitle>
                        <DialogDescription>
                            Generate a registration link. When opened on a device, that browser will be permanently locked to this kiosk.
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedUrl ? (
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>Device Name</Label>
                                <Input
                                    placeholder="e.g. iPad - Front Gate"
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                />
                            </div>
                            <Button className="w-full" onClick={handleGenerate} disabled={!deviceName.trim() || generating}>
                                <Link2 className="mr-2 h-4 w-4" />
                                {generating ? 'Generating...' : 'Generate Registration Link'}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 pt-2">
                            <div className="flex justify-center">
                                <div className="rounded-xl border-2 border-primary/20 bg-white p-4 shadow-lg shadow-primary/5">
                                    <QRCodeSVG value={generatedUrl} size={200} level="M" includeMargin={false} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Registration Link</Label>
                                <div className="flex gap-2">
                                    <Input readOnly value={generatedUrl} className="text-xs" />
                                    <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                                        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Scan the QR or open the link on the target device. Expires in 10 minutes.
                                </p>
                            </div>
                            <Button variant="outline" className="w-full" onClick={handleCloseDialog}>
                                Done
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
