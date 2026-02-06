import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface FormFieldProps {
    label: string;
    icon?: LucideIcon;
    required?: boolean;
    tooltip?: string;
    children: ReactNode;
}

export function FormField({ label, icon: Icon, required, tooltip, children }: FormFieldProps) {
    return (
        <div className="space-y-1">
            <Label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                {Icon && <Icon className="h-3 w-3" />}
                {label}
                {required && (
                    <Badge variant="outline" className="ml-1 h-4 px-1 text-[10px]">
                        Required
                    </Badge>
                )}
                {tooltip && (
                    <Tooltip>
                        <TooltipTrigger>
                            <HelpCircle className="text-muted-foreground/50 h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="text-xs">{tooltip}</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </Label>
            {children}
        </div>
    );
}

interface TextInputFieldProps extends Omit<FormFieldProps, 'children'> {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function TextInputField({ label, icon, required, tooltip, value, onChange, placeholder }: TextInputFieldProps) {
    return (
        <FormField label={label} icon={icon} required={required} tooltip={tooltip}>
            <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" placeholder={placeholder} />
        </FormField>
    );
}
