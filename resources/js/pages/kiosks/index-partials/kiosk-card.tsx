import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useInitials } from '@/hooks/use-initials';
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
    const getInitials = useInitials();
    return (
        <Card className="w-full min-w-96 p-4">
            <CardTitle>{kiosk.name}</CardTitle>
            <CardDescription>
                <Label
                    className="block max-w-xs truncate text-sm font-normal"
                    title={`${kiosk.eh_location_id} - ${kiosk.location?.name?.trim() || 'N/A'}`}
                >
                    {kiosk.eh_location_id} - {kiosk.location?.name?.trim() || 'N/A'}
                </Label>
                <div className="mt-2 flex items-center justify-between">
                    <Label>Default Start time</Label>
                    <Label className="text-muted-foreground">
                        {(() => {
                            const [hour, minute] = kiosk.default_start_time.split(':');
                            const date = new Date();
                            date.setHours(Number(hour), Number(minute));
                            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                        })()}
                    </Label>
                </div>
                <div className="mt-2 flex items-center justify-between">
                    <Label>Default End time</Label>
                    <Label className="text-muted-foreground">
                        {(() => {
                            const [hour, minute] = kiosk.default_end_time.split(':');
                            const date = new Date();
                            date.setHours(Number(hour), Number(minute));
                            return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                        })()}
                    </Label>
                </div>
                <div>
                    {kiosk.employees && kiosk.employees.length > 0 ? (
                        <Label className="mt-2 flex items-center gap-2">
                            Employees:{' '}
                            <div className="flex -space-x-1 overflow-hidden">
                                {kiosk.employees.slice(0, 5).map((employee, idx) => (
                                    <Avatar key={employee.name + idx} className="h-8 w-8 overflow-hidden rounded-full">
                                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                            {getInitials(employee.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                ))}
                                {kiosk.employees.length > 5 && (
                                    <Avatar>
                                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                            +{kiosk.employees.length - 5}
                                        </AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        </Label>
                    ) : (
                        <Label className="mt-2">No employees assigned</Label>
                    )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                    {' '}
                    <Link href={`/kiosks/${kiosk.id}`}>
                        <Button>Open</Button>
                    </Link>
                    <Link href={`/kiosks/${kiosk.id}/edit`}>
                        <Button variant="outline">
                            {' '}
                            <Settings />
                        </Button>
                    </Link>
                </div>
            </CardDescription>
        </Card>
    );
};

export default KioskCard;
