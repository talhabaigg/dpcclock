import CsvImporterDialog from '@/components/csv-importer';
import { router } from '@inertiajs/react';
import { useState } from 'react';

const FavouriteMaterialUploader = ({ locationId }: { locationId: number }) => {
    const [favImportHeaders] = useState<string[]>(['location_id', 'code']);

    const handleCsvSubmit = (mappedData: any[]) => {
        // Build rows in header order
        const rows = mappedData.map((row) => favImportHeaders.map((h) => row[h] ?? '').join(','));

        const csvContent = `${favImportHeaders.join(',')}\n${rows.join('\n')}`;
        const file = new File([csvContent], 'exported_data.csv', { type: 'text/csv' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('location_id', locationId.toString());

        router.post(`/location/${locationId}/favourite-materials/upload`, formData, {
            forceFormData: true,
        });
    };

    return <CsvImporterDialog requiredColumns={favImportHeaders} onSubmit={handleCsvSubmit} />;
};

export default FavouriteMaterialUploader;
