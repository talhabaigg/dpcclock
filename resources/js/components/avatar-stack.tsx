import PersonAvatar from '@/components/person-avatar';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInitials } from '@/hooks/use-initials';

interface Person {
    id: number;
    name: string;
}

interface AvatarStackProps {
    people: Person[];
    max?: number;
    size?: 'default' | 'sm' | 'lg';
}

export default function AvatarStack({ people, max = 5, size = 'sm' }: AvatarStackProps) {
    const getInitials = useInitials();

    if (people.length === 0) {
        return <span className="text-muted-foreground text-sm">-</span>;
    }

    const shown = people.slice(0, max);
    const overflow = people.length - max;
    const countTextClass = size === 'sm' ? 'text-xs' : '';

    return (
        <TooltipProvider>
            <AvatarGroup>
                {shown.map((person) => (
                    <Tooltip key={person.id}>
                        <TooltipTrigger asChild>
                            <Avatar size={size}>
                                <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{person.name}</TooltipContent>
                    </Tooltip>
                ))}
                {overflow > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <AvatarGroupCount className={`${countTextClass} cursor-pointer hover:bg-muted/80`}>+{overflow}</AvatarGroupCount>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1" align="end">
                            <ul className="max-h-64 overflow-y-auto">
                                {people.slice(max).map((p) => (
                                    <li key={p.id} className="rounded px-2 py-1.5 hover:bg-muted">
                                        <PersonAvatar name={p.name} />
                                    </li>
                                ))}
                            </ul>
                        </PopoverContent>
                    </Popover>
                )}
            </AvatarGroup>
        </TooltipProvider>
    );
}
