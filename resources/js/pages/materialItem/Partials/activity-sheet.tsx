import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserInfo } from '@/components/user-info';
import { User } from '@/types';
import { ArrowUp, ClockAlert } from 'lucide-react';

interface ActivitySheetProps {
    activities: Activity[];
}

interface Activity {
    id: number;
    event: string;
    created_at: string;
    log_name: string;
    causer?: User;
    properties: {
        attributes?: Record<string, any>;
        old?: Record<string, any>;
    };
}
const ActivitySheet = ({ activities }: ActivitySheetProps) => {
    console.log(activities);
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <ClockAlert />
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Change Log</SheetTitle>
                    <SheetDescription>Here is a list of recent changes made to this material item.</SheetDescription>
                </SheetHeader>
                <div className="mx-4 -mt-6">
                    <Card className="m-0 mt-4 max-w-96 p-0 text-sm sm:max-w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Event</TableCell>
                                    <TableCell>Performed by</TableCell>
                                    <TableCell>Performed On</TableCell>
                                    <TableCell>Performed at</TableCell>
                                    <TableCell>Properties</TableCell>
                                </TableRow>
                            </TableHeader>

                            {activities.map((a) => {
                                return (
                                    <TableRow>
                                        <TableCell>{a.id}</TableCell>
                                        <TableCell>{a.event}</TableCell>
                                        <TableCell className="w-full">
                                            {a.causer && (
                                                <div className="flex w-48 flex-row items-center space-x-2">
                                                    {' '}
                                                    <UserInfo user={{ ...a.causer }}></UserInfo>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>{a.log_name}</TableCell>
                                        <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                                        <TableCell>
                                            {/* New attributes table */}
                                            {a.properties?.attributes ? (
                                                <Card className="mb-2 p-0">
                                                    <Table className="rounded-lg">
                                                        <TableHeader>
                                                            <TableRow>
                                                                {Object.keys(a.properties.attributes).map((key) => (
                                                                    <TableHead key={key} className="border-r">
                                                                        {key}
                                                                    </TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            <TableRow>
                                                                {Object.values(a.properties.attributes).map((value, index) => (
                                                                    <TableCell className="border-r" key={index}>
                                                                        {String(value)}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </Card>
                                            ) : (
                                                <em>No attributes</em>
                                            )}

                                            {/* Old values table */}
                                            {a.properties?.old ? (
                                                <>
                                                    <ArrowUp />
                                                    <Card className="p-0">
                                                        <Table className="rounded-lg">
                                                            <TableHeader>
                                                                <TableRow>
                                                                    {Object.keys(a.properties.old).map((key) => (
                                                                        <TableHead key={key} className="border-r">
                                                                            {key}
                                                                        </TableHead>
                                                                    ))}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                <TableRow>
                                                                    {Object.values(a.properties.old).map((value, index) => (
                                                                        <TableCell className="border-r" key={index}>
                                                                            {String(value)}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </Card>
                                                </>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </Table>
                    </Card>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default ActivitySheet;
