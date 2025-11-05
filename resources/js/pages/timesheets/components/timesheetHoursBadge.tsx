import { Badge } from '@/components/ui/badge';
import StatusBadge from './statusBadge';

const TimesheetHoursBadge = ({ clock }) => {
    return (
        <Badge
            variant="secondary"
            key={clock.id}
            className={`mx-auto ${
                clock.eh_worktype_id === 2471108 ? 'bg-green-200 text-green-800' : clock.eh_worktype_id === 2471109 ? 'bg-blue-200 text-blue-800' : ''
            }`}
        >
            {clock.clock_out ? clock.hours_worked : 'x'}
            <StatusBadge status={clock.status} />
        </Badge>
    );
};
export default TimesheetHoursBadge;
