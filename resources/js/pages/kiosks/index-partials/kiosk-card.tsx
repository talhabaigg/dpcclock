import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInitials } from '@/hooks/use-initials';
import { Link } from '@inertiajs/react';
import { ChevronRight, Clock, MapPin, Settings, Users } from 'lucide-react';

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
    const getInitials = useInitials();
    const employeeCount = kiosk.employees?.length || 0;

    return (
        <Card className="group flex flex-col overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold leading-tight">{kiosk.name}</h3>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate" title={kiosk.location?.name?.trim() || 'N/A'}>
                                {kiosk.location?.name?.trim() || 'N/A'}
                            </span>
                        </div>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 font-mono text-xs">
                        {kiosk.eh_location_id}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                {/* Time Schedule */}
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-1 items-center justify-between text-sm">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatTime(kiosk.default_start_time)}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="font-medium text-rose-600 dark:text-rose-400">{formatTime(kiosk.default_end_time)}</span>
                    </div>
                </div>

                {/* Employees */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{employeeCount} employee{employeeCount !== 1 ? 's' : ''}</span>
                    </div>
                    {kiosk.employees && kiosk.employees.length > 0 && (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex -space-x-2">
                                        {kiosk.employees.slice(0, 4).map((employee, idx) => (
                                            <Avatar
                                                key={employee.name + idx}
                                                className="h-7 w-7 border-2 border-background transition-transform hover:z-10 hover:scale-110"
                                            >
                                                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                                    {getInitials(employee.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                        ))}
                                        {kiosk.employees.length > 4 && (
                                            <Avatar className="h-7 w-7 border-2 border-background">
                                                <AvatarFallback className="bg-muted text-xs font-medium">
                                                    +{kiosk.employees.length - 4}
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                    <p className="mb-1 text-xs font-medium">Assigned Employees</p>
                                    <div className="text-xs text-muted-foreground">
                                        {kiosk.employees.slice(0, 8).map((e) => e.name).join(', ')}
                                        {kiosk.employees.length > 8 && ` and ${kiosk.employees.length - 8} more`}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center gap-2 pt-2">
                    <Link href={`/kiosks/${kiosk.id}`} className="flex-1">
                        <Button className="w-full gap-2" size="sm">
                            Open
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                    </Link>
                    <Link href={`/kiosks/${kiosk.id}/edit`}>
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
};

export default KioskCard;
