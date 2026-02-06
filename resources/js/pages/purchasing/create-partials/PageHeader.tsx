import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon: LucideIcon;
    iconVariant?: 'default' | 'warning';
    actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, iconVariant = 'default', actions }: PageHeaderProps) {
    return (
        <div className="bg-card flex-shrink-0 border-b px-4 py-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-lg',
                            iconVariant === 'default' && 'bg-primary/10',
                            iconVariant === 'warning' && 'bg-amber-500/10',
                        )}
                    >
                        <Icon className={cn('h-4 w-4', iconVariant === 'default' && 'text-primary', iconVariant === 'warning' && 'text-amber-600')} />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold">{title}</h1>
                        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
                    </div>
                </div>
                {actions && <div className="hidden items-center gap-2 sm:flex">{actions}</div>}
            </div>
        </div>
    );
}
