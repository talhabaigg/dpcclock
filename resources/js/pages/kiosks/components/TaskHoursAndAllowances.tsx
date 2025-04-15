import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type props = {
    task: {
        hours: number;
        insulation_allowance?: boolean;
        setout_allowance?: boolean;
    };
    index: number;
    updateTaskAllocation: (index: number, field: string, value: any) => void;
};

export default function TaskHoursAndAllowances({ task, index, updateTaskAllocation }: props) {
    return (
        <div className="flex w-full flex-row items-center justify-between">
            <div className="w-1/2 flex-1">
                <Label>Hours</Label>
                <Input
                    type="number"
                    value={task.hours}
                    onChange={(e) => updateTaskAllocation(index, 'hours', parseFloat(e.target.value))}
                    className="w-3/4 sm:w-full"
                    min="0"
                    step="0.5"
                />
            </div>

            <div className="w-1/2 flex-1">
                {(task.insulation_allowance || task.setout_allowance) && <Label>Allowances</Label>}
                <div className="flex w-1/2 flex-1 flex-row items-center space-x-2">
                    {task.insulation_allowance && (
                        <>
                            <span role="img" aria-label="checked" className="text-green-500">
                                ✔️
                            </span>
                            <Label>Insulation</Label>
                        </>
                    )}

                    {task.setout_allowance && (
                        <>
                            <span role="img" aria-label="checked" className="text-green-500">
                                ✔️
                            </span>
                            <Label>SetOut</Label>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
