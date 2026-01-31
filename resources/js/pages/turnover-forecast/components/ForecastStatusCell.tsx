import { CheckCircle2, Clock, MinusCircle } from 'lucide-react';

type ForecastStatus = 'not_started' | 'draft' | 'submitted' | 'finalized';

interface ForecastStatusCellProps {
    value: ForecastStatus | undefined;
}

export function ForecastStatusCell({ value }: ForecastStatusCellProps) {
    if (!value) return null;

    switch (value) {
        case 'finalized':
            return (
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Finalized</span>
                </div>
            );
        case 'submitted':
            return (
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">Submitted</span>
                </div>
            );
        case 'draft':
            return (
                <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Draft</span>
                </div>
            );
        case 'not_started':
        default:
            return (
                <div className="flex items-center gap-1.5">
                    <MinusCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Not Started</span>
                </div>
            );
    }
}
