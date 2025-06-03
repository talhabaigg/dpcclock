import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
interface TimesheetSummaryCardProps {
    name: string;
    timesheet_qty: number;
    expandAll: () => void;
    collapseAll: () => void;
}

const TimesheetSummaryCard: React.FC<TimesheetSummaryCardProps> = ({ name, timesheet_qty, expandAll, collapseAll }) => {
    const [allCollapsed, setAllCollapsed] = useState(true);
    const handleCollapseToggle = () => {
        if (allCollapsed) {
            expandAll();
            setAllCollapsed(false);
        } else {
            collapseAll();
            setAllCollapsed(true);
        }
    };
    return (
        <Card className="max-w-2xl">
            {name ? (
                <>
                    <CardHeader>
                        <CardTitle>Timesheets Summary - {name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Label>Total</Label>
                        <div className="flex flex-row justify-between">
                            <div>
                                <Button className="rounded-lg bg-gray-500 px-2" size="sm">
                                    {timesheet_qty}
                                </Button>
                                {timesheet_qty > 0 ? (
                                    <Label className="mx-2">timesheets</Label>
                                ) : (
                                    <Label className="mx-2">No timesheets found for the selected employee</Label>
                                )}
                            </div>
                            <div className="flex flex-row space-x-2">
                                <Button
                                    onClick={handleCollapseToggle}
                                    className="w-full"
                                    variant="secondary"
                                    title={allCollapsed ? 'Expand all rows' : 'Collapse all rows'}
                                >
                                    <ChevronDown className={`transition-transform duration-300 ${allCollapsed ? 'rotate-0' : 'rotate-180'}`} />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </>
            ) : (
                <>
                    <CardHeader>
                        <CardTitle>Please select an employee to view timesheets available</CardTitle>
                    </CardHeader>
                </>
            )}
        </Card>
    );
};
export default TimesheetSummaryCard;
