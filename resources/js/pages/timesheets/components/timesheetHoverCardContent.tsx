import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
const TimesheetHoverCardTable = ({ clock: c }) => {
    return (
        <Table className="p-0">
            <TableBody>
                <TableRow>
                    <TableCell className="font-semibold"> Worktype</TableCell>
                    <TableCell>{c.work_type ? c.work_type.name : 'N/A'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-semibold"> Clocked In</TableCell>
                    <TableCell>{c.clock_in ? new Date(c.clock_in).toLocaleTimeString() : 'N/A'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-semibold"> Clocked Out</TableCell>
                    <TableCell>{c.clock_out ? new Date(c.clock_out).toLocaleTimeString() : 'N/A'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-semibold">Level</TableCell>
                    <TableCell>
                        {(() => {
                            if (!c.location?.external_id) return '';
                            const parts = c.location.external_id.split('::');
                            const level = parts[1]?.split('-')[0] || '';
                            return level;
                        })()}
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-semibold">Task</TableCell>
                    <TableCell>
                        {(() => {
                            if (!c.location?.external_id) return '';
                            const parts = c.location.external_id.split('::');
                            const afterDoubleColon = parts[1] || ''; // e.g. "NEW_15-000_Reinstatement"
                            const hyphenParts = afterDoubleColon.split('-');
                            const secondPart = hyphenParts[1] || ''; // e.g. "000_Reinstatement"
                            const task = secondPart.slice(4);
                            return task;
                        })()}
                    </TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-semibold"> Created at</TableCell>
                    <TableCell>{c.created_at ? new Date(c.created_at).toLocaleTimeString() : 'N/A'}</TableCell>
                </TableRow>
                <TableRow>
                    <TableCell className="font-semibold"> Updated at</TableCell>
                    <TableCell>{c.updated_at ? new Date(c.updated_at).toLocaleTimeString() : 'N/A'}</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
};
export default TimesheetHoverCardTable;
