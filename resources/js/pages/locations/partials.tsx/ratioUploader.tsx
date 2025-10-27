import CsvImporterDialog from '@/components/csv-importer';
import { router } from '@inertiajs/react';
import { useState } from 'react';

const RatioUploader = ({ locationId }: { locationId: number }) => {
    const [favImportHeaders] = useState<string[]>(['job_number', 'cost_code', 'variation_ratio', 'dayworks_ratio']);

    const handleCsvSubmit = (mappedData: any[]) => {
        // Build rows in header order
        const rows = mappedData.map((row) => favImportHeaders.map((h) => row[h] ?? '').join(','));

        const csvContent = `${favImportHeaders.join(',')}\n${rows.join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('location_id', locationId.toString());

        router.post(`/location/${locationId}/cost-code-ratios/upload`, formData, {
            forceFormData: true,
        });
    };

    return <CsvImporterDialog requiredColumns={favImportHeaders} onSubmit={handleCsvSubmit} />;
};

export default RatioUploader;
