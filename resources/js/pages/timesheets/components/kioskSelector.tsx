import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
};

export default function KioskSelector({
    kiosks,
    selectedKiosk,
    onChange,
}: {
    kiosks: Kiosk[];
    selectedKiosk: number | null;
    onChange: (val: string) => void;
}) {
    return (
        <Select value={selectedKiosk !== null ? String(selectedKiosk) : ''} onValueChange={onChange}>
            <SelectTrigger className="w-full border-none shadow-none">
                <SelectValue placeholder="Select a kiosk" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Kiosks</SelectLabel>
                    {kiosks.map((kiosk) => (
                        <SelectItem key={kiosk.eh_kiosk_id} value={String(kiosk.eh_kiosk_id)}>
                            {kiosk.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
