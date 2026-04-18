import CsvImporterDialog from '@/components/csv-importer';

interface ImportTasksDialogProps {
    onImport: (rows: Record<string, string>[]) => void;
}

const REQUIRED_COLUMNS = ['WBS', 'Task Name', 'Start Date', 'End Date', 'Baseline Start', 'Baseline Finish', 'Color', 'Critical'];

export default function ImportTasksDialog({ onImport }: ImportTasksDialogProps) {
    return (
        <CsvImporterDialog
            requiredColumns={REQUIRED_COLUMNS}
            onSubmit={(mappedData) => {
                // Transform column names to API field names
                const tasks = mappedData
                    .filter((row) => row['WBS'] && row['Task Name'])
                    .map((row) => ({
                        wbs: row['WBS'],
                        name: row['Task Name'],
                        start_date: row['Start Date'] || null,
                        end_date: row['End Date'] || null,
                        baseline_start: row['Baseline Start'] || null,
                        baseline_finish: row['Baseline Finish'] || null,
                        color: row['Color'] || null,
                        critical: row['Critical'] || null,
                    }));
                onImport(tasks as unknown as Record<string, string>[]);
            }}
        />
    );
}
