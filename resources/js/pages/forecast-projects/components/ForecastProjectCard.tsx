import { Badge } from '@/components/ui/badge';
import { Link } from '@inertiajs/react';

export interface ForecastProjectCardData {
    id: number;
    name: string;
    project_number: string;
    company?: string | null;
    status: string;
    total_revenue_budget?: number;
    created_by_name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
}

const currency = (value?: number | null) =>
    value != null
        ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value)
        : '-';

const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export function ForecastProjectCard({ project }: { project: ForecastProjectCardData }) {
    const period = [formatDate(project.start_date), formatDate(project.end_date)].filter(Boolean).join(' – ');

    return (
        <Link href={`/forecast-projects/${project.id}`} className="block">
            <div className="flex items-start justify-between gap-1">
                <span className="truncate text-xs font-medium leading-tight">{project.name}</span>
                {project.company && (
                    <Badge variant="outline" className="h-4 shrink-0 text-[10px] leading-none">
                        {project.company}
                    </Badge>
                )}
            </div>
            <p className="text-muted-foreground font-mono text-xs">{project.project_number}</p>
            <p className="text-muted-foreground truncate text-xs">Budget: {currency(project.total_revenue_budget)}</p>
            {period && <p className="text-muted-foreground truncate text-xs">{period}</p>}
            {project.created_by_name && <p className="text-muted-foreground mt-0.5 truncate text-xs">by {project.created_by_name}</p>}
        </Link>
    );
}
