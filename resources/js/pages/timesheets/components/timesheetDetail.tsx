import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function TimesheetDetailTable({ entries }: { entries: any[] }) {
    return (
        <div className="flex flex-col gap-2 p-2">
            <Table className="border border-gray-200">
                <TableHeader className="bg-gray-50 dark:bg-black">
                    <TableRow className="border-b">
                        <TableHead className="border">Status</TableHead>
                        <TableHead className="border">Start Time</TableHead>
                        <TableHead className="border">End Time</TableHead>
                        <TableHead className="border">Level/Activity</TableHead>
                        <TableHead className="border">Hours</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((entry, i) => (
                        <TableRow key={entry.id ?? i} className="border-b">
                            <>
                                <TableCell className="border">
                                    {entry.status === 'synced' && <span className="text-green-500">Synced</span>}
                                </TableCell>
                                <TableCell className="border">
                                    {new Date(entry.clock_in).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </TableCell>
                                <TableCell className="border">
                                    {entry.clock_out ? (
                                        new Date(entry.clock_out).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })
                                    ) : (
                                        <Label className="text-yellow-500">Still clocked in {entry.kiosk.name}</Label>
                                    )}
                                </TableCell>
                                <TableCell className="border">{entry.location?.external_id}</TableCell>
                                <TableCell className="border">{entry.hours_worked}</TableCell>
                            </>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
