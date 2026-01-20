import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface TaskHoursAndAllowancesProps {
    task: {
        hours: number;
        insulation_allowance?: boolean;
        setout_allowance?: boolean;
    };
    index: number;
    updateTaskAllocation: (index: number, field: string, value: number) => void;
}

export default function TaskHoursAndAllowances({ task }: TaskHoursAndAllowancesProps) {
    const hasAllowances = task.insulation_allowance || task.setout_allowance;

    if (!hasAllowances) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {task.insulation_allowance && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600">Insulation</span>
                </div>
            )}
            {task.setout_allowance && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600">SetOut</span>
                </div>
            )}
        </div>
    );
}
