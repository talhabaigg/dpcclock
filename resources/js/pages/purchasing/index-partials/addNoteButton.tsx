import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { Loader2, MessageSquarePlus, Send, X } from 'lucide-react';
import { useState } from 'react';

interface AddNoteButtonProps {
    requisition_id: number;
}

const AddNoteButton = ({ requisition_id }: AddNoteButtonProps) => {
    const { data, setData, post, processing, errors, reset } = useForm({
        requisition_id: requisition_id,
        note: '',
    });

    const [open, setOpen] = useState(false);

    const submitForm = (e: React.FormEvent) => {
        e.preventDefault();
        post('/requisition/' + requisition_id + '/notes', {
            onSuccess: () => {
                reset('note');
                setOpen(false);
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
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 rounded text-slate-400 transition-colors hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50 dark:hover:text-blue-400"
                    title="Add note"
                >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                </Button>
            </DialogTrigger>

            <DialogContent className="overflow-hidden border-slate-200 bg-white p-0 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-md">
                {/* Header with gradient accent */}
                <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 px-6 py-4 dark:border-slate-800 dark:from-blue-950/50 dark:to-slate-900">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                                <MessageSquarePlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            Add Note
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Add a note to requisition #{requisition_id}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <form onSubmit={submitForm}>
                    <div className="px-6 py-4">
                        <Textarea
                            placeholder="Enter your note here..."
                            value={data.note}
                            onChange={(e) => setData('note', e.target.value)}
                            className="min-h-[120px] resize-none border-slate-200 bg-slate-50/50 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800/50 dark:placeholder:text-slate-500 dark:focus:border-blue-600 dark:focus:bg-slate-800"
                            autoFocus
                        />

                        {errors.note && (
                            <div className="mt-2 flex items-center gap-1.5 text-sm text-red-500">
                                <X className="h-3.5 w-3.5" />
                                {errors.note}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="flex w-full items-center justify-end gap-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={processing || !data.note.trim()}
                                className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-3.5 w-3.5" />
                                        Save Note
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddNoteButton;
