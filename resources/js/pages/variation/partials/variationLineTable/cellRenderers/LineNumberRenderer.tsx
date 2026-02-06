import { CustomCellRendererProps } from 'ag-grid-react';

export const LineNumberRenderer = (props: CustomCellRendererProps) => {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="bg-primary/10 text-primary border-primary/20 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold">
                {props.value}
            </div>
        </div>
    );
};
