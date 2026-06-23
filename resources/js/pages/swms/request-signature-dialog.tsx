import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, QrCode, Smartphone, Tablet } from 'lucide-react';

export interface KioskEmployee {
    id: number;
    name: string;
    phone: string | null;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    swmsIds: string[];
    swmsNames: string[];
    employees: KioskEmployee[];
}

type Delivery = 'ipad' | 'qr' | 'sms';

interface CreatedResponse {
    id: string;
    token: string;
    public_url: string;
    short_url: string | null;
    delivery_method: Delivery;
    expires_at: string | null;
}

export function RequestSignatureDialog({ open, onOpenChange, locationId, swmsIds, swmsNames, employees }: Props) {
    const [selectedEmployees, setSelectedEmployees] = useState<Set<number>>(new Set());
    const [delivery, setDelivery] = useState<Delivery>('ipad');
    const [phone, setPhone] = useState('');
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [created, setCreated] = useState<CreatedResponse | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const reset = () => {
        setSelectedEmployees(new Set());
        setDelivery('ipad');
        setPhone('');
        setSearch('');
        setCreated(null);
        setErrorMsg(null);
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) reset();
        onOpenChange(next);
    };

    const filtered = employees.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

    const toggleEmp = (id: number) => {
        const next = new Set(selectedEmployees);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedEmployees(next);
    };

    const submit = async () => {
        setErrorMsg(null);
        setSubmitting(true);
        try {
            const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
            const res = await fetch(`/locations/${locationId}/swms/signing-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    swms_ids: swmsIds,
                    employee_ids: Array.from(selectedEmployees),
                    delivery_method: delivery,
                    recipient_phone: delivery === 'sms' ? phone : null,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setErrorMsg(body?.message ?? 'Could not create signing request.');
                return;
            }
            const data: CreatedResponse = await res.json();
            setCreated(data);
        } catch {
            setErrorMsg('Network error. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit =
        swmsIds.length > 0 &&
        selectedEmployees.size > 0 &&
        (delivery !== 'sms' || phone.trim().length > 0);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Request SWMS signature</DialogTitle>
                </DialogHeader>

                {!created ? (
                    <div className="space-y-4">
                        <div>
                            <div className="text-muted-foreground text-xs uppercase tracking-wide">SWMS in this request</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {swmsNames.map((n, i) => (
                                    <Badge key={i} variant="secondary" className="font-normal">
                                        {n}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label>Workers</Label>
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search workers..."
                                className="mt-1"
                            />
                            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                                {filtered.length === 0 ? (
                                    <p className="text-muted-foreground p-3 text-center text-sm">No workers found.</p>
                                ) : (
                                    filtered.map((emp) => (
                                        <label
                                            key={emp.id}
                                            className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                                        >
                                            <Checkbox
                                                checked={selectedEmployees.has(emp.id)}
                                                onCheckedChange={() => toggleEmp(emp.id)}
                                            />
                                            <span className="flex-1 text-sm">{emp.name}</span>
                                            {emp.phone && <span className="text-muted-foreground text-xs">{emp.phone}</span>}
                                        </label>
                                    ))
                                )}
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs">{selectedEmployees.size} selected</p>
                        </div>

                        <div>
                            <Label>Delivery</Label>
                            <div className="mt-1 grid grid-cols-3 gap-2">
                                <DeliveryOption
                                    icon={<Tablet className="h-4 w-4" />}
                                    label="iPad"
                                    desc="Sign on this device"
                                    selected={delivery === 'ipad'}
                                    onClick={() => setDelivery('ipad')}
                                />
                                <DeliveryOption
                                    icon={<QrCode className="h-4 w-4" />}
                                    label="QR code"
                                    desc="Scan on phone"
                                    selected={delivery === 'qr'}
                                    onClick={() => setDelivery('qr')}
                                />
                                <DeliveryOption
                                    icon={<Smartphone className="h-4 w-4" />}
                                    label="SMS"
                                    desc="Send link by text"
                                    selected={delivery === 'sms'}
                                    onClick={() => setDelivery('sms')}
                                />
                            </div>
                            {delivery === 'sms' && (
                                <div className="mt-3">
                                    <Label htmlFor="recipient-phone">Mobile number</Label>
                                    <Input
                                        id="recipient-phone"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+61..."
                                    />
                                    {selectedEmployees.size === 1 && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            Defaults to the selected worker&apos;s mobile if blank.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {errorMsg && <p className="text-destructive text-sm">{errorMsg}</p>}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => handleOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={submit} disabled={!canSubmit || submitting}>
                                Create request
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <CreatedView created={created} delivery={delivery} onClose={() => handleOpenChange(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function DeliveryOption({
    icon,
    label,
    desc,
    selected,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    desc: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
                selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
        >
            <div className="flex items-center gap-2 text-sm font-medium">
                {icon}
                {label}
            </div>
            <span className="text-muted-foreground text-xs">{desc}</span>
        </button>
    );
}

function CreatedView({
    created,
    delivery,
    onClose,
}: {
    created: CreatedResponse;
    delivery: Delivery;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const url = created.short_url ?? created.public_url;
    const expiresOn = created.expires_at ? new Date(created.expires_at).toLocaleDateString('en-AU') : null;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // ignore
        }
    };

    return (
        <div className="space-y-4">
            {delivery === 'qr' && (
                <div className="flex flex-col items-center gap-3">
                    <div className="rounded-md border bg-white p-4">
                        <QRCodeSVG value={created.public_url} size={220} level="M" />
                    </div>
                    <p className="text-muted-foreground text-center text-xs">
                        Workers scan this QR with their phone and enter their kiosk PIN.
                    </p>
                </div>
            )}

            {delivery === 'ipad' && (
                <div>
                    <p className="text-sm">Open the sign page on this iPad:</p>
                    <Button asChild className="mt-2 w-full">
                        <a href={created.public_url} target="_blank" rel="noreferrer">
                            Open sign page
                        </a>
                    </Button>
                </div>
            )}

            {delivery === 'sms' && (
                <div className="space-y-2">
                    <p className="text-sm">SMS sent. Workers can also access the request here:</p>
                </div>
            )}

            <div className="space-y-1">
                <Label className="text-xs">Sharable link</Label>
                <div className="flex gap-2">
                    <Input readOnly value={url} className="font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={copy} aria-label="Copy link">
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
                {copied && <p className="text-muted-foreground text-xs">Copied</p>}
            </div>

            {expiresOn && (
                <p className="text-muted-foreground text-xs">Expires {expiresOn}.</p>
            )}

            <DialogFooter>
                <Button onClick={onClose}>Done</Button>
            </DialogFooter>
        </div>
    );
}
