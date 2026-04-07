import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const BADGE_STYLES: Record<string, string> = {
    report: 'bg-gray-100 text-gray-700 border-gray-200',
    first_aid: 'bg-blue-100 text-blue-700 border-blue-200',
    mti: 'bg-orange-100 text-orange-700 border-orange-200',
    lti: 'bg-red-100 text-red-700 border-red-200',
};

interface InjuryStatusBadgeProps {
    reportType: string | null;
    label: string | null;
}

export default function InjuryStatusBadge({ reportType, label }: InjuryStatusBadgeProps) {
    if (!reportType || !label) return null;

    return <Badge className={cn(BADGE_STYLES[reportType] ?? 'bg-gray-100 text-gray-700')}>{label}</Badge>;
}
