import type { UnifiedRow } from '../lib/data-transformer';

interface LabourCellProps {
    data: UnifiedRow;
    month: string;
}

export function LabourCell({ data, month }: LabourCellProps) {
    const reqValue = data.labourRequired?.[month] ?? 0;
    const reqRounded = Math.ceil(reqValue);

    return <span className="tabular-nums">{reqRounded}</span>;
}
