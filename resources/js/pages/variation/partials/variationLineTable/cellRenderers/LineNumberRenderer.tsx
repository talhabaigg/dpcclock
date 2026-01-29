import { CustomCellRendererProps } from 'ag-grid-react';

export const LineNumberRenderer = (props: CustomCellRendererProps) => {
    return (
        <div className="flex h-full items-center justify-center w-full">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary border border-primary/20">
                {props.value}
            </div>
        </div>
    );
};
