import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Calculator, DollarSign, Home, Receipt, Users } from 'lucide-react';
import React from 'react';

type PaymentRule = {
    icon: React.ReactNode;
    title: string;
    description: string;
};

const PAYMENT_RULES: PaymentRule[] = [
    {
        icon: <Users className="h-3.5 w-3.5" />,
        title: 'Wages',
        description: '70% paid same month, 30% tax paid +1 month',
    },
    {
        icon: <Calculator className="h-3.5 w-3.5" />,
        title: 'Oncosts',
        description: 'Paid +1 month (no GST)',
    },
    {
        icon: <Building2 className="h-3.5 w-3.5" />,
        title: 'Vendor Costs',
        description: 'Paid +1 month, 10% GST included',
    },
    {
        icon: <DollarSign className="h-3.5 w-3.5" />,
        title: 'Revenue',
        description: 'Received +2 months, 10% GST collected',
    },
    {
        icon: <Receipt className="h-3.5 w-3.5" />,
        title: 'GST Payable',
        description: 'Net GST due quarterly, paid month after quarter end',
    },
    {
        icon: <Home className="h-3.5 w-3.5" />,
        title: 'General Transactions',
        description: 'Overheads, rent, subscriptions, and income items.',
    },
];

const PaymentRuleCard = ({ icon, title, description }: PaymentRule) => (
    <div className="flex items-start gap-2.5 rounded-md border px-2.5 py-2">
        <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
            <span className="text-foreground text-sm font-medium">{title}</span>
            <p className="text-muted-foreground text-xs leading-snug">{description}</p>
        </div>
    </div>
);

type PaymentRulesDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export const PaymentRulesDialog = ({ open, onOpenChange }: PaymentRulesDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Payment Timing Rules</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PAYMENT_RULES.map((rule, index) => (
                    <PaymentRuleCard key={index} {...rule} />
                ))}
            </div>
        </DialogContent>
    </Dialog>
);
