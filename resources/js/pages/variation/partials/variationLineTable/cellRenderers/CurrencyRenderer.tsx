import { CustomCellRendererProps } from 'ag-grid-react';

export const CurrencyRenderer = (props: CustomCellRendererProps) => {
    const value = props.value != null ? parseFloat(props.value) : 0;
    const formatted = `$${value.toFixed(2)}`;

    // Add green color for revenue field if cost_type is REV
    const isRevenue = props.colDef?.field === 'revenue' && props.data?.cost_type === 'REV';

    return (
        <div className={`flex h-full items-center justify-end ${isRevenue ? 'text-green-600 font-medium' : ''}`}>
            {formatted}
        </div>
    );
};
