import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Papa from 'papaparse';
import { useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';

function CsvImporterDialog({ requiredColumns, onSubmit, onClose }) {
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvData, setCsvData] = useState([]);
    const [mappings, setMappings] = useState({}); // { requiredColumn: mappedCsvHeader }

    // Handle file drop or selection
    const handleFile = (file) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setCsvHeaders(results.meta.fields);
                setCsvData(results.data);
                // Reset mappings on new file
                setMappings({});
            },
        });
    };

    // Handle mapping change for a required column
    const handleMappingChange = (requiredCol, csvHeader) => {
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
            const mappedRow = {};
            for (const requiredCol of requiredColumns) {
                mappedRow[requiredCol] = row[mappings[requiredCol]] ?? '';
            }
            return mappedRow;
        });

        onSubmit(mappedData);
        onClose();
    };

    return (
        <div className="dialog-backdrop">
            <div className="dialog-content" style={{ maxWidth: 600, margin: 'auto', background: 'white', padding: 20 }}>
                <Dialog>
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
                                    <Label>Map Columns</Label>
                                    {requiredColumns.map((reqCol) => (
                                        <div key={reqCol} className="flex items-center justify-between gap-2">
                                            <Label>
                                                <strong>{reqCol}</strong> &nbsp;
                                            </Label>
                                            <Select
                                                placeholder="Select CSV column"
                                                value={mappings[reqCol] || ''}
                                                onValueChange={(value) => handleMappingChange(reqCol, value)}
                                            >
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
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-row items-start justify-between gap-2">
                            <Button onClick={handleSubmit}>Submit Mapped CSV</Button>
                            <Button onClick={onClose} variant="outline">
                                Cancel
                            </Button>
                        </div>
                        <DialogFooter>{/* <Button type="submit">Save changes</Button> */}</DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dropzone */}
            </div>
        </div>
    );
}

export default CsvImporterDialog;
