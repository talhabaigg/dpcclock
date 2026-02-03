import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForm } from '@inertiajs/react';
import { Loader2, Pencil } from 'lucide-react';
import { useState } from 'react';

interface EditPriceDialogProps {
    locationId: number;
    materialItemId: number;
    code: string;
    description: string;
    currentPrice: number;
    isLocked: boolean;
}

export default function EditPriceDialog({
    locationId,
    materialItemId,
    code,
    description,
    currentPrice,
    isLocked,
}: EditPriceDialogProps) {
    const [open, setOpen] = useState(false);

    const form = useForm({
        unit_cost_override: currentPrice.toString(),
        is_locked: isLocked,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({
            unit_cost_override: parseFloat(data.unit_cost_override) || 0,
            is_locked: data.is_locked,
        }));
        form.patch(route('locations.updateMaterialPrice', { location: locationId, materialItemId }), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
            },
        });
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            // Reset form to current values when opening
            form.setData({
                unit_cost_override: currentPrice.toString(),
                is_locked: isLocked,
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground opacity-0 transition-all hover:text-primary group-hover:opacity-100"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Price</DialogTitle>
                    <DialogDescription>
                        Update the price for <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{code}</code>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="text-sm text-muted-foreground line-clamp-2">{description}</div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Unit Cost Override</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.data.unit_cost_override}
                                    onChange={(e) => form.setData('unit_cost_override', e.target.value)}
                                    className="pl-7"
                                    autoFocus
                                />
                            </div>
                            {form.errors.unit_cost_override && (
                                <p className="text-sm text-destructive">{form.errors.unit_cost_override}</p>
                            )}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="lock-price">Lock Price</Label>
                                <p className="text-xs text-muted-foreground">Prevent automatic price updates</p>
                            </div>
                            <Switch
                                id="lock-price"
                                checked={form.data.is_locked}
                                onCheckedChange={(checked) => form.setData('is_locked', checked)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
