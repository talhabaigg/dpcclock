import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Users,
    Calculator,
    Building2,
    DollarSign,
    Receipt,
    Home,
} from 'lucide-react';

type PaymentRule = {
    icon: React.ReactNode;
    title: string;
    description: string;
    colorScheme: {
        bg: string;
        border: string;
        iconBg: string;
        iconColor: string;
        titleColor: string;
    };
};

const PAYMENT_RULES: PaymentRule[] = [
    {
        icon: <Users className="w-4 h-4" />,
        title: 'Wages',
        description: '70% paid same month, 30% tax paid +1 month',
        colorScheme: {
            bg: 'bg-blue-50/50 dark:bg-blue-950/30',
            border: 'border-blue-100 dark:border-blue-900',
            iconBg: 'bg-blue-100 dark:bg-blue-900',
            iconColor: 'text-blue-600 dark:text-blue-400',
            titleColor: 'text-blue-900 dark:text-blue-100',
        },
    },
    {
        icon: <Calculator className="w-4 h-4" />,
        title: 'Oncosts',
        description: 'Paid +1 month (no GST)',
        colorScheme: {
            bg: 'bg-purple-50/50 dark:bg-purple-950/30',
            border: 'border-purple-100 dark:border-purple-900',
            iconBg: 'bg-purple-100 dark:bg-purple-900',
            iconColor: 'text-purple-600 dark:text-purple-400',
            titleColor: 'text-purple-900 dark:text-purple-100',
        },
    },
    {
        icon: <Building2 className="w-4 h-4" />,
        title: 'Vendor Costs',
        description: 'Paid +1 month, 10% GST included',
        colorScheme: {
            bg: 'bg-orange-50/50 dark:bg-orange-950/30',
            border: 'border-orange-100 dark:border-orange-900',
            iconBg: 'bg-orange-100 dark:bg-orange-900',
            iconColor: 'text-orange-600 dark:text-orange-400',
            titleColor: 'text-orange-900 dark:text-orange-100',
        },
    },
    {
        icon: <DollarSign className="w-4 h-4" />,
        title: 'Revenue',
        description: 'Received +2 months, 10% GST collected',
        colorScheme: {
            bg: 'bg-green-50/50 dark:bg-green-950/30',
            border: 'border-green-100 dark:border-green-900',
            iconBg: 'bg-green-100 dark:bg-green-900',
            iconColor: 'text-green-600 dark:text-green-400',
            titleColor: 'text-green-900 dark:text-green-100',
        },
    },
    {
        icon: <Receipt className="w-4 h-4" />,
        title: 'GST Payable',
        description: 'Net GST due quarterly, paid month after quarter end',
        colorScheme: {
            bg: 'bg-red-50/50 dark:bg-red-950/30',
            border: 'border-red-100 dark:border-red-900',
            iconBg: 'bg-red-100 dark:bg-red-900',
            iconColor: 'text-red-600 dark:text-red-400',
            titleColor: 'text-red-900 dark:text-red-100',
        },
    },
    {
        icon: <Home className="w-4 h-4" />,
        title: 'General Transactions',
        description: 'Overheads, rent, subscriptions, and income items.',
        colorScheme: {
            bg: 'bg-slate-50 dark:bg-slate-800/50',
            border: 'border-slate-200 dark:border-slate-700',
            iconBg: 'bg-slate-100 dark:bg-slate-700',
            iconColor: 'text-slate-600 dark:text-slate-400',
            titleColor: 'text-slate-900 dark:text-slate-100',
        },
    },
];

type PaymentRuleCardProps = PaymentRule;

const PaymentRuleCard = ({
    icon,
    title,
    description,
    colorScheme,
}: PaymentRuleCardProps) => (
    <div
        className={`flex items-start gap-3 p-3 rounded-lg ${colorScheme.bg} border ${colorScheme.border}`}
    >
        <div
            className={`w-8 h-8 rounded-lg ${colorScheme.iconBg} flex items-center justify-center flex-shrink-0`}
        >
            <span className={colorScheme.iconColor}>{icon}</span>
        </div>
        <div>
            <span className={`font-medium ${colorScheme.titleColor}`}>{title}</span>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{description}</p>
        </div>
    </div>
);

export const PaymentRulesLegend = () => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment Timing Rules</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {PAYMENT_RULES.map((rule, index) => (
                    <PaymentRuleCard key={index} {...rule} />
                ))}
            </div>
        </CardContent>
    </Card>
);
