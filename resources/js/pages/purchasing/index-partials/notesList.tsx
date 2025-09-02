import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
const NotesList = ({ notes }) => {
    const getInitials = useInitials();

    return (
        <div className="h-100 overflow-y-auto">
            {notes.reverse().map((note) => (
                <div className="my-2 mr-1 flex flex-row rounded-md border p-2 shadow-sm hover:shadow-md">
                    <Avatar>
                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                            {getInitials(note.creator?.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="ml-2">{note.note}</div>
                        <div className="ml-2 text-xs">{new Date(note.created_at).toLocaleString('en-AU')}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotesList;
