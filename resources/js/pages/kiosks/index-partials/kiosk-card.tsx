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

const KioskCard = ({ kiosk }: KioskCardProps) => {
    const kioskName = kiosk.name.trim();
    const locationName = kiosk.location?.name?.trim();
    const showLocation = Boolean(locationName) && locationName !== kioskName;

    return (
        <Card className="hover:bg-muted/30 hover:ring-foreground/20 relative gap-0 p-0 shadow-none transition-colors">
            <Link href={`/kiosks/${kiosk.id}`} className="block px-5 py-5 pr-10">
                <div className="truncate text-base leading-snug font-medium" title={kioskName}>
                    {kioskName}
                </div>
                {showLocation && (
                    <div className="text-muted-foreground mt-1 truncate text-xs" title={locationName}>
                        {locationName}
                    </div>
                )}
            </Link>

            <Link href={`/kiosks/${kiosk.id}/edit`} className="absolute top-2.5 right-2.5 z-10">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
                    <Settings className="h-3.5 w-3.5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </Link>
        </Card>
    );
};

export default KioskCard;
