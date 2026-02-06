import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface RemoveMaterialDialogProps {
    locationId: number;
    materialItemId: number;
    code: string;
    description: string;
}

export default function RemoveMaterialDialog({ locationId, materialItemId, code, description }: RemoveMaterialDialogProps) {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = () => {
        setIsDeleting(true);
        router.delete(route('locations.detachMaterial', { location: locationId, materialItemId }), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
            },
            onFinish: () => {
                setIsDeleting(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Remove Material</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to remove <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{code}</code> from the
                        price list?
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-muted-foreground line-clamp-2 text-sm">{description}</p>
                    <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">This action will be recorded in the price history.</p>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Removing...
                            </>
                        ) : (
                            <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
