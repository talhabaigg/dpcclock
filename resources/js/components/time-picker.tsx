import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
}

const HOURS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

function parseTime(value: string): { hour: string; minute: string; period: string } {
    if (!value) return { hour: '', minute: '00', period: 'AM' };

    const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return { hour: '', minute: '00', period: 'AM' };

    return {
        hour: match[1],
        minute: match[2] ?? '00',
        period: match[3].toUpperCase(),
    };
}

function formatTime(hour: string, minute: string, period: string): string {
    if (!hour) return '';
    if (minute === '00') return `${hour}${period}`;
    return `${hour}:${minute}${period}`;
}

export function TimePicker({ value, onChange }: TimePickerProps) {
    const parsed = parseTime(value);

    const update = (field: 'hour' | 'minute' | 'period', val: string) => {
        const next = { ...parsed, [field]: val };
        if (field === 'hour' && !parsed.period) next.period = 'AM';
        onChange(formatTime(next.hour, next.minute, next.period));
    };

    return (
        <div className="flex gap-1.5">
            <Select value={parsed.hour} onValueChange={(v) => update('hour', v as string)}>
                <SelectTrigger className="w-20">
                    <SelectValue placeholder="Hr" />
                </SelectTrigger>
                <SelectContent>
                    {HOURS.map((h) => (
                        <SelectItem key={h} value={h}>
                            {h}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={parsed.minute} onValueChange={(v) => update('minute', v as string)}>
                <SelectTrigger className="w-20">
                    <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                    {MINUTES.map((m) => (
                        <SelectItem key={m} value={m}>
                            :{m}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={parsed.period} onValueChange={(v) => update('period', v as string)}>
                <SelectTrigger className="w-20">
                    <SelectValue placeholder="AM" />
                </SelectTrigger>
                <SelectContent>
                    {PERIODS.map((p) => (
                        <SelectItem key={p} value={p}>
                            {p}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
