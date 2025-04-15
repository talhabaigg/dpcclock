import { Label } from '@/components/ui/label';

export default function TaskLevelDisplay({ task }) {
    return (
        <div>
            <div className="rounded border p-1 text-black sm:w-full">
                <Label className="dark:text-white">
                    {task.level?.slice(7)}
                    <span className="dark:text-white">-{task.activity ? task.activity.slice(4) : 'No activity selected'}</span>
                </Label>
            </div>
        </div>
    );
}
