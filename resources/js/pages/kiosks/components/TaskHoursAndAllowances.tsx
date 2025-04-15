import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TaskHoursAndAllowances({ task, index, updateTaskAllocation }) {
    return (
        <div className="flex flex-row items-center justify-between">
            <div className="flex-1">
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

            <div>
                {(task.insulation_allowance || task.setout_allowance) && <Label>Allowances</Label>}
                <div className="flex flex-row items-center space-x-2">
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
