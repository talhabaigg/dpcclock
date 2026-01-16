import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { UserInfo } from '@/components/user-info';
import { router } from '@inertiajs/react';
import { Pencil, Trash } from 'lucide-react';
import TimesheetHoursBadge from './timesheetHoursBadge';
import TimesheetHoverCardTable from './timesheetHoverCardContent';

type Clock = {
    id: number | string;
    clock_in: string; // "YYYY-MM-DD HH:mm:ss"
    status: string;
    clock_out: string | null;
    hours_worked: number;
    eh_location_id: string | number;
    eh_worktype_id: number | null;
    location?: { parentLocation: { eh_location_id: string | number }; external_id: string };
    work_type?: { eh_worktype_id: number; name: string };
    created_at: string;
    updated_at: string;
};

type EmployeeRow = {
    id: number | string;
    name: string;
    eh_employee_id: string | number;
    email: string;
    timesheet?: {
        days: Record<string, Clock[]>; // keys: "YYYY-MM-DD" -> array of clocks
    } | null;
    total_hours_week: number;
};

interface ReviewTimesheetGridProps {
    days: string[]; // ["2025-10-29","2025-10-30",...]
    employees: EmployeeRow[];
    flash: { success?: string };
}

const ReviewTimesheetGrid = ({ days, employees, flash }: ReviewTimesheetGridProps) => {
    void flash; // Used for displaying flash messages
    return (
        <Card className="m-2 p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableCell className="font-semibold">Employee Name</TableCell>
                        <TableCell className="">Employee ID</TableCell>
                        {days.map((day) => (
                            <TableCell key={day} className="text-center font-semibold">
                                <div>{new Date(day).toLocaleDateString('en-AU', { weekday: 'short' })}</div>
                                <div>{new Date(day).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })}</div>
                            </TableCell>
                        ))}
                        <TableCell className="font-semibold">Total</TableCell>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {employees.map((emp) => (
                        <TableRow key={emp.id}>
                            {/* <TableCell className="border-r font-bold whitespace-nowrap">{emp.name}</TableCell> */}
                            <TableCell className="flex items-center gap-2 font-medium">
                                <UserInfo
                                    user={{
                                        ...emp,
                                        id: Number(emp.id),
                                        email: emp.email,
                                        email_verified_at: '',
                                        created_at: '',
                                        updated_at: '',
                                        phone: '',
                                    }}
                                ></UserInfo>
                            </TableCell>
                            <TableCell className="align-top">{emp.eh_employee_id}</TableCell>

                            {days.map((day) => {
                                const clocks: Clock[] = emp.timesheet?.days?.[day] ?? [];
                                return (
                                    <>
                                        <TableCell key={day} className="align-top text-sm">
                                            {clocks.length === 0 ? (
                                                <span className="text-muted-foreground flex w-full justify-center">
                                                    <Badge className="mx-auto" variant="secondary">
                                                        -
                                                    </Badge>
                                                </span>
                                            ) : (
                                                <div className="flex flex-col space-y-1">
                                                    {clocks.map((c) => {
                                                        return (
                                                            <>
                                                                <HoverCard>
                                                                    <HoverCardTrigger className="mx-auto">
                                                                        {' '}
                                                                        <TimesheetHoursBadge clock={c} />
                                                                    </HoverCardTrigger>
                                                                    <HoverCardContent className="w-full p-1">
                                                                        <div className="flex justify-end space-x-2">
                                                                            <Button size="icon" variant="outline">
                                                                                <Pencil />
                                                                            </Button>

                                                                            <Button
                                                                                variant="outline"
                                                                                size="icon"
                                                                                onClick={() => {
                                                                                    router.delete(`/clocks/${c.id}/delete`, {});
                                                                                }}
                                                                            >
                                                                                <Trash />
                                                                            </Button>
                                                                        </div>
                                                                        <TimesheetHoverCardTable clock={c} />
                                                                    </HoverCardContent>
                                                                </HoverCard>
                                                            </>
                                                        );
                                                    })}

                                                    {clocks.length > 1 && (
                                                        <>
                                                            <Separator className="mx-auto my-1 max-w-12" />
                                                            <Badge variant="secondary" className="mx-auto">
                                                                {clocks.reduce((total, c) => total + Number(c.hours_worked), 0)}
                                                            </Badge>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                    </>
                                );
                            })}
                            <TableCell className="align-top">
                                <Badge
                                    variant="secondary"
                                    className={`mx-auto ${emp.total_hours_week > 40 ? 'border-1 border-red-700 text-red-700' : ''}`}
                                >
                                    {emp.total_hours_week}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
};

export default ReviewTimesheetGrid;
