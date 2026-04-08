import { Badge } from '@/components/ui/badge';

interface InjuryStatusBadgeProps {
    reportType: string | null;
    label: string | null;
}

export default function InjuryStatusBadge({ reportType, label }: InjuryStatusBadgeProps) {
    if (!reportType || !label) return null;

    return <Badge variant="secondary">{label}</Badge>;
}
