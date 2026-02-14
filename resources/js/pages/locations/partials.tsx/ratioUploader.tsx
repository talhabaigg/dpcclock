import { ImporterWizardTrigger } from '@/components/importer-wizard';
import type { ImporterColumnDef } from '@/components/importer-wizard';
import { router } from '@inertiajs/react';

const columns: ImporterColumnDef[] = [
    { key: 'cost_code', label: 'Cost Code', required: true, aliases: ['code', 'costcode', 'cost code'] },
    {
        key: 'variation_ratio',
        label: 'Variation Ratio',
        type: 'number',
        aliases: ['variation', 'variation %', 'variation_pct'],
        validate: (v) => (v && Number(v) < 0 ? 'Must be >= 0' : null),
    },
    {
        key: 'dayworks_ratio',
        label: 'Dayworks Ratio',
        type: 'number',
        aliases: ['dayworks', 'dayworks %', 'dayworks_pct'],
        validate: (v) => (v && Number(v) < 0 ? 'Must be >= 0' : null),
    },
    {
        key: 'waste_ratio',
        label: 'Waste Ratio',
        type: 'number',
        aliases: ['waste', 'waste %', 'waste_pct'],
        validate: (v) => (v && Number(v) < 0 ? 'Must be >= 0' : null),
    },
    { key: 'prelim_type', label: 'Prelim Type', aliases: ['type', 'prelim', 'mat/lab'] },
];

const RatioUploader = ({ locationId }: { locationId: number }) => {
    const handleSubmit = async (rows: Record<string, string>[]) => {
        return new Promise<void>((resolve, reject) => {
            router.post(
                `/location/${locationId}/cost-code-ratios/upload`,
                { rows },
                {
                    onSuccess: () => resolve(),
                    onError: () => reject(new Error('Upload failed')),
                },
            );
        });
    };

    return (
        <ImporterWizardTrigger
            title="Import Cost Code Ratios"
            description="Upload a CSV or Excel file with cost code ratios."
            columns={columns}
            onSubmit={handleSubmit}
        />
    );
};

export default RatioUploader;
