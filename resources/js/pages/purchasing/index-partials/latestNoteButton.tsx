import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInitials } from '@/hooks/use-initials';
import { DialogTrigger } from '@radix-ui/react-dialog';
import NotesDialog from './notesDialog';
const LatestNoteButton = ({ requisition }) => {
    const getInitials = useInitials();
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="flex flex-row rounded-md border p-2 shadow-sm hover:shadow-md">
                    <Avatar>
                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                            {getInitials(requisition.notes?.slice(-1)[0].creator?.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="ml-2">{requisition.notes?.slice(-1)[0].note}</div>
                        <div className="ml-2 text-xs">{new Date(requisition.notes?.slice(-1)[0].created_at).toLocaleString('en-AU')}</div>
                    </div>
                </div>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                </DialogHeader>
                <NotesDialog requisition_id={requisition.id} notes={requisition.notes} />
            </DialogContent>
        </Dialog>
    );
};

export default LatestNoteButton;
