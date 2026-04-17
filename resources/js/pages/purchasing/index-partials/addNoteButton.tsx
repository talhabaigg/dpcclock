import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useForm } from '@inertiajs/react';
import { Check, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface AddNoteButtonProps {
    requisition_id: number;
}

const AddNoteButton = ({ requisition_id }: AddNoteButtonProps) => {
    const { data, setData, post, processing, errors, reset } = useForm({
        requisition_id: requisition_id,
        note: '',
    });

    const [open, setOpen] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    const submitForm = (e: React.FormEvent) => {
        e.preventDefault();
        post('/requisition/' + requisition_id + '/notes', {
            onSuccess: () => {
                setJustSaved(true);
                // Brief success confirmation before closing so the user sees the check.
                setTimeout(() => {
                    reset('note');
                    setOpen(false);
                    setJustSaved(false);
                    toast.success('Note added successfully');
                }, 450);
            },
            onError: () => {
                toast.error('Failed to save note');
            },
        });
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            reset('note');
        }
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 transition-transform duration-100 ease-out hover:scale-110 active:scale-90"
                    title="Add note"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
                >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                className="w-80"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={submitForm} className="flex flex-col gap-2.5">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium">Add note</p>
                        <p className="text-muted-foreground text-xs">To requisition #{requisition_id}</p>
                    </div>

                    <Textarea
                        placeholder="Enter your note..."
                        value={data.note}
                        onChange={(e) => setData('note', e.target.value)}
                        className="min-h-[90px] resize-none transition-[box-shadow,border-color] duration-150"
                        autoFocus
                    />

                    {errors.note && (
                        <p className="text-destructive text-xs animate-in fade-in slide-in-from-top-0.5 duration-200">
                            {errors.note}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenChange(false)}
                            className="transition-transform duration-100 ease-out active:scale-95"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={processing || justSaved || !data.note.trim()}
                            className={cn(
                                'gap-1.5 transition-all duration-150 ease-out active:scale-95',
                                justSaved && 'bg-emerald-600 hover:bg-emerald-600',
                            )}
                        >
                            {justSaved ? (
                                <span key="saved" className="flex items-center gap-1.5 animate-in fade-in zoom-in-75 duration-200">
                                    <Check className="h-3.5 w-3.5" />
                                    Saved
                                </span>
                            ) : processing ? (
                                <span key="saving" className="flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Saving
                                </span>
                            ) : (
                                <span key="save" className="flex items-center gap-1.5">
                                    <Send className="h-3.5 w-3.5" />
                                    Save
                                </span>
                            )}
                        </Button>
                    </div>
                </form>
            </PopoverContent>
        </Popover>
    );
};

export default AddNoteButton;
