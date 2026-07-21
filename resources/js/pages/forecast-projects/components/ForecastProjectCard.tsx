import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@inertiajs/react';
import { EllipsisVertical } from 'lucide-react';

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
    archived_at?: string | null;
}

interface ForecastProjectCardProps {
    project: ForecastProjectCardData;
    onEdit?: () => void;
    onDelete?: () => void;
    onArchive?: () => void;
    onUnarchive?: () => void;
    onViewActivity?: () => void;
    onOpenForecast?: () => void;
}

const currency = (value?: number | null) =>
    value != null
        ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value)
        : '-';

const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export function ForecastProjectCard({
    project,
    onEdit,
    onDelete,
    onArchive,
    onUnarchive,
    onViewActivity,
    onOpenForecast,
}: ForecastProjectCardProps) {
    const period = [formatDate(project.start_date), formatDate(project.end_date)].filter(Boolean).join(' – ');
    const hasActions = Boolean(onEdit || onDelete || onArchive || onUnarchive || onViewActivity || onOpenForecast);

    return (
        <div className="relative">
            <Link href={`/forecast-projects/${project.id}`} className="block">
                <div className={`flex items-start justify-between gap-1 ${hasActions ? 'pr-6' : ''}`}>
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

            {hasActions && (
                <div className="absolute right-0 top-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Card actions" className="h-5 w-5">
                                <EllipsisVertical className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-max">
                            {onOpenForecast && (
                                <DropdownMenuItem className="whitespace-nowrap" onClick={onOpenForecast}>
                                    Job Forecast
                                </DropdownMenuItem>
                            )}
                            {onEdit && (
                                <DropdownMenuItem className="whitespace-nowrap" onClick={onEdit}>
                                    Edit
                                </DropdownMenuItem>
                            )}
                            {onViewActivity && (
                                <DropdownMenuItem className="whitespace-nowrap" onClick={onViewActivity}>
                                    View activity log
                                </DropdownMenuItem>
                            )}
                            {project.archived_at
                                ? onUnarchive && (
                                      <DropdownMenuItem className="whitespace-nowrap" onClick={onUnarchive}>
                                          Restore from archive
                                      </DropdownMenuItem>
                                  )
                                : onArchive && (
                                      <DropdownMenuItem className="whitespace-nowrap" onClick={onArchive}>
                                          Archive
                                      </DropdownMenuItem>
                                  )}
                            {onDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive whitespace-nowrap"
                                        onClick={onDelete}
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
}
