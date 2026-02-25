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
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={`hover:underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 cursor-help ${className}`}>
                    {label}
                </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
                {helpText}
            </TooltipContent>
        </Tooltip>
    );
}
