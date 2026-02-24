import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FieldLabelProps {
    label: string;
    helpText?: string;
    className?: string;
}

export default function FieldLabel({ label, helpText, className = '' }: FieldLabelProps) {
    if (!helpText) {
        return <span className={className}>{label}</span>;
    }

    return (
        <span className={`flex items-center gap-1.5 ${className}`}>
            {label}
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                    {helpText}
                </TooltipContent>
            </Tooltip>
        </span>
    );
}