import LocationActionsMenu from '@/components/location-actions-menu';
import { type ReactNode } from 'react';

type Props = {
    location: { id: number; name: string; closed_at?: string | null };
    title: string;
    titleAdornment?: ReactNode;
    children?: ReactNode;
};

export default function LocationPageHeader({ location, title, titleAdornment, children }: Props) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{title}</h2>
                {titleAdornment}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {children}
                <LocationActionsMenu location={location} />
            </div>
        </div>
    );
}
