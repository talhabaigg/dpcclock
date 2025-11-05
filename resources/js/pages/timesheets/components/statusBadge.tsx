import { CircleCheck, RefreshCcw } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
    return (
        <span>
            {status === 'Approved' ? (
                <CircleCheck className="w-3" stroke="green" />
            ) : status === 'synced' ? (
                <RefreshCcw className="w-3" stroke="yellow" />
            ) : (
                ''
            )}
        </span>
    );
};
export default StatusBadge;
