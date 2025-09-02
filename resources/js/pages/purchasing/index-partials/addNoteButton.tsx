import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { CirclePlus } from 'lucide-react';
import { useState } from 'react';

const AddNoteButton = ({ requisition_id }) => {
    const { data, setData, post, processing, errors } = useForm({
        requisition_id: requisition_id,
        note: '',
    });

    const [open, setOpen] = useState(false);

    const submitForm = (e) => {
        e.preventDefault();
        console.log('Submitting form with data:', data);
        post('/requisition/' + requisition_id + '/notes');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <CirclePlus className="h-4 w-4" /> Add note
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                </DialogHeader>
                <form onSubmit={submitForm}>
                    <Textarea placeholder="Type your message here." value={data.note} onChange={(e) => setData('note', e.target.value)} />

                    {errors.note && <p className="mt-2 text-sm text-red-500">{errors.note}</p>}

                    <DialogFooter className="mt-2">
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit"> {processing ? 'Submitting...' : 'Submit'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddNoteButton;
