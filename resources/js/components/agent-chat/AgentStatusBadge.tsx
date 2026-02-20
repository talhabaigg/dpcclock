import { Badge } from '@/components/ui/badge';
import { Bot, Check, Loader2, AlertCircle, Clock } from 'lucide-react';

interface AgentStatusBadgeProps {
    agentStatus: string | null;
}

export default function AgentStatusBadge({ agentStatus }: AgentStatusBadgeProps) {
    if (!agentStatus) return null;

    const config = getConfig(agentStatus);

    return (
        <Badge variant="outline" className={`gap-1 ${config.className}`}>
            {config.icon}
            {config.label}
        </Badge>
    );
}

function getConfig(status: string) {
    switch (status) {
        case 'awaiting_confirmation':
            return {
                label: 'Agent: Awaiting Confirmation',
                className: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400 animate-pulse',
                icon: <Clock className="h-3 w-3" />,
            };
        case 'sending':
            return {
                label: 'Agent: Sending to Supplier',
                className: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400 animate-pulse',
                icon: <Loader2 className="h-3 w-3 animate-spin" />,
            };
        case 'completed':
            return {
                label: 'Agent: Sent',
                className: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
                icon: <Check className="h-3 w-3" />,
            };
        case 'failed':
            return {
                label: 'Agent: Failed',
                className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400',
                icon: <AlertCircle className="h-3 w-3" />,
            };
        default:
            return {
                label: `Agent: ${status}`,
                className: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
                icon: <Bot className="h-3 w-3" />,
            };
    }
}
