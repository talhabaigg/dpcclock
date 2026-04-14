import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@inertiajs/react';
import { Settings } from 'lucide-react';

interface KioskCardProps {
    kiosk: {
        id: number;
        name: string;
        eh_location_id: string;
        location?: {
            name?: string;
        };
        default_start_time: string;
        default_end_time: string;
        employees?:
            | {
                  name: string;
              }[]
            | undefined;
    };
}

const formatTime = (time: string) => {
    const [hour, minute] = time.split(':');
    const date = new Date();
    date.setHours(Number(hour), Number(minute));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};

const KioskCard = ({ kiosk }: KioskCardProps) => {
    const employeeCount = kiosk.employees?.length ?? 0;
    const kioskName = kiosk.name.trim();
    const locationName = kiosk.location?.name?.trim() || 'No location';

    return (
        <Card className="hover:border-foreground/20 relative transition-colors">
            <Link href={`/kiosks/${kiosk.id}`} className="flex min-h-[140px] flex-col justify-between gap-4 p-6">
                <div className="min-w-0 space-y-1 pr-9">
                    <div className="truncate text-lg leading-tight font-semibold" title={kioskName}>
                        {kioskName}
                    </div>
                    <div className="text-muted-foreground truncate text-sm" title={locationName}>
                        {locationName}
                    </div>
                </div>

                <div className="text-muted-foreground flex items-center gap-2 text-sm tabular-nums">
                    <span>
                        {formatTime(kiosk.default_start_time)} – {formatTime(kiosk.default_end_time)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                        {employeeCount} employee{employeeCount !== 1 ? 's' : ''}
                    </span>
                </div>
            </Link>

            <Link href={`/kiosks/${kiosk.id}/edit`} className="absolute top-3 right-3">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Settings className="h-4 w-4" />
                    <span className="sr-only">Settings</span>
                </Button>
            </Link>
        </Card>
    );
};

export default KioskCard;
