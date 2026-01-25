import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { buildLabourForecastColumnDefs } from './column-builders';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Location {
    id: number;
    name: string;
    eh_location_id: number;
    eh_parent_id: number;
    state: string;
    job_number: string;
}

interface LabourForecastIndexProps {
    locations: Location[];
}

const LabourForecastIndex = ({ locations }: LabourForecastIndexProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Forecast', href: '/labour-forecast' }];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-4">
                <h1 className="text-xl font-semibold mb-4">Labour Forecast</h1>
                <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
                    <AgGridReact
                        columnDefs={buildLabourForecastColumnDefs()}
                        rowData={locations}
                        defaultColDef={{
                            resizable: true,
                        }}
                    />
                </div>
            </div>
        </AppLayout>
    );
};

export default LabourForecastIndex;
