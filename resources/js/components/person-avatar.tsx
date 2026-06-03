import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';

interface PersonAvatarProps {
    name: string | null | undefined;
    size?: 'default' | 'sm' | 'lg';
}

export default function PersonAvatar({ name, size = 'sm' }: PersonAvatarProps) {
    const getInitials = useInitials();

    if (!name) return <span className="text-muted-foreground">-</span>;

    return (
        <div className="flex items-center gap-2">
            <Avatar size={size}>
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <span>{name}</span>
        </div>
    );
}
