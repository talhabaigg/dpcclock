import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
interface TimesheetSummaryCardProps {
    name: string;
    timesheet_qty: number;
}

const TimesheetSummaryCard: React.FC<TimesheetSummaryCardProps> = ({ name, timesheet_qty }) => {
    return <Card className="max-w-2xl">
        {name ? ( <><CardHeader>
            <CardTitle>Timesheets Summary - {name}</CardTitle>
        </CardHeader><CardContent>
                <Label>Total</Label>
                <div>
                    <Button className="rounded-lg bg-gray-500 px-2 " size="sm">
                        {timesheet_qty}
                    </Button>
                    {timesheet_qty > 0 ? (<Label className="mx-2">timesheets</Label>) : (<Label className="mx-2">No timesheets found for the selected employee</Label>)}

                </div>
            </CardContent></>) : (<><CardHeader><CardTitle>Please select an employee to view timesheets available</CardTitle></CardHeader></>)} 
       
    </Card>;
}
export default TimesheetSummaryCard;