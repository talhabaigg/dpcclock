import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Papa from 'papaparse';
import { useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';

type CsvImporterDialogProps = {
    requiredColumns: string[]; // List of required columns to map
    onSubmit: (mappedData: Record<string, string>[]) => void; // Callback to handle the mapped data
};
function CsvImporterDialog({ requiredColumns, onSubmit }: CsvImporterDialogProps) {
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({}); // { requiredColumn: mappedCsvHeader }
    const [isOpen, setIsOpen] = useState(false);

    // Handle file drop or selection
    const handleFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setCsvHeaders(results.meta.fields ?? []);
                setCsvData((results.data as Record<string, string>[]) ?? []);
                // Reset mappings on new file
                setMappings({});
            },
        });
    };

    // Handle mapping change for a required column
    const handleMappingChange = (requiredCol: string, csvHeader: string) => {
        setMappings((prev) => ({
            ...prev,
            [requiredCol]: csvHeader,
        }));
    };

    // On submit: create mapped data array and send
    const handleSubmit = () => {
        // Check all required columns are mapped
        const allMapped = requiredColumns.every((col) => mappings[col]);
        if (!allMapped) {
            alert('Please map all required columns before submitting.');
            return;
        }

        // Map each CSV row according to user mappings
        const mappedData = csvData.map((row) => {
            const mappedRow: { [key: string]: string } = {};
            for (const requiredCol of requiredColumns) {
                mappedRow[requiredCol] = row[mappings[requiredCol]] ?? '';
            }
            return mappedRow;
        });

        onSubmit(mappedData);
        setIsOpen(false); // Close dialog after submission
    };

    return (
        <div className="dialog-backdrop">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline">Import</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>CSV Importer</DialogTitle>
                        <DialogDescription>Upload your CSV file to import data.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Dropzone
                            onDrop={(acceptedFiles) => {
                                if (acceptedFiles.length > 0) {
                                    handleFile(acceptedFiles[0]);
                                }
                            }}
                            accept={{ 'text/csv': ['.csv'] }}
                            maxFiles={1}
                            multiple={false}
                        />

                        {/* Show mapping UI only if we have headers */}
                        {csvHeaders.length > 0 && (
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label>Map Columns</Label>
                                    <Label>Data Preview</Label>
                                </div>

                                {requiredColumns.map((reqCol) => (
                                    <div key={reqCol} className="flex flex-col gap-2">
                                        <div className="flex w-full flex-row items-center justify-between gap-2">
                                            <Label>
                                                <strong>{reqCol}</strong> &nbsp;
                                            </Label>
                                            <Select value={mappings[reqCol] || ''} onValueChange={(value) => handleMappingChange(reqCol, value)}>
                                                <SelectTrigger className="w-[200px]">
                                                    <span>{mappings[reqCol] || 'Select CSV column'}</span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {csvHeaders.map((header) => (
                                                        <SelectItem key={header} value={header}>
                                                            {header}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {mappings[reqCol] && csvData.length > 0 && (
                                            <div className="flex flex-wrap">
                                                {csvData.slice(0, 6).map((row, index) => (
                                                    <Badge className="m-0.5 border border-gray-500 p-0.5" key={index}>
                                                        {row[mappings[reqCol]]}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-row items-start justify-between gap-2">
                        <Button onClick={handleSubmit}>Import</Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsOpen(false);
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                    <DialogFooter>{/* <Button type="submit">Save changes</Button> */}</DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dropzone */}
        </div>
    );
}

export default CsvImporterDialog;
