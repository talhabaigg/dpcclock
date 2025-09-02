import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import NotesList from './notesList';

const NotesDialog = ({ requisition_id, notes }) => {
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
        <div>
            <NotesList notes={notes} />
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
        </div>
    );
};

export default NotesDialog;
