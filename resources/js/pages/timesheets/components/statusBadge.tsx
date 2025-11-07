import { CircleCheck, CircleX, RefreshCcw } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
    return (
        <span>
            {status === 'Approved' ? (
                <CircleCheck className="w-3" stroke="green" />
            ) : status === 'synced' ? (
                <RefreshCcw className="w-3" stroke="gray" />
            ) : status === 'Rejected' ? (
                <CircleX className="w-3" stroke="red" />
            ) : status === 'Processed' ? (
                <div className="flex h-4 w-4 items-center justify-center rounded-sm border-1 border-blue-700 p-0 text-blue-700">P</div>
            ) : null}
        </span>
    );
};
export default StatusBadge;
