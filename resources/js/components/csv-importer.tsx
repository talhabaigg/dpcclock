import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import Papa from 'papaparse';
import { useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import * as XLSX from 'xlsx';
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
        const name = file.name.toLowerCase();

        if (name.endsWith('.csv')) {
            // CSV path (Papa)
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                transform: (value) => {
                    if (typeof value === 'string') return value.trim();
                    return value == null ? '' : String(value);
                },
                complete: (results) => {
                    const fields = results.meta.fields ?? [];
                    const rows = (results.data as Record<string, string>[]) ?? [];

                    setCsvHeaders(fields);
                    setCsvData(rows);
                    setMappings({});
                },
            });
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            // Excel path (SheetJS)
            const reader = new FileReader();

            reader.onload = (e) => {
                const data = e.target?.result as ArrayBuffer;
                const workbook = XLSX.read(data, {
                    type: 'array',
                    cellDates: false,
                    raw: false, // use formatted cell text
                });
                console.log(workbook);

                const sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                // Convert to JSON like Papa's output
                const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
                    defval: '',
                    raw: false, // again: formatted text, not raw serials
                });
                console.log(rows);

                // Get headers from the first row's keys
                const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

                // Coerce all values to strings (same shape as CSV path)
                const normalisedRows: Record<string, string>[] = rows.map((row) => {
                    const obj: Record<string, string> = {};
                    headers.forEach((h) => {
                        const v = row[h];
                        obj[h] = v == null ? '' : String(v).trim();
                    });
                    return obj;
                });

                setCsvHeaders(headers);
                setCsvData(normalisedRows);
                setMappings({});
            };

            reader.readAsArrayBuffer(file);
        } else {
            alert('Unsupported file type. Please upload a CSV or Excel file.');
        }
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
                    <Button variant="outline">
                        {' '}
                        <Upload />
                        Import
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Data Importer</DialogTitle>
                        <DialogDescription>Upload your CSV/Excel file to import data.</DialogDescription>
                        <DialogDescription className="font-slim mt-2 text-sm text-gray-500">
                            Format columns to text or number before copying data to avoid excel converting values to dates or scientific notation
                            respectively.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Dropzone
                            onDrop={(acceptedFiles) => {
                                if (acceptedFiles.length > 0) {
                                    handleFile(acceptedFiles[0]);
                                }
                            }}
                            accept={{
                                'text/csv': ['.csv'],
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                                'application/vnd.ms-excel': ['.xls'],
                            }}
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
                                setCsvHeaders([]); // Reset headers
                                setCsvData([]); // Reset data
                                setMappings({}); // Reset mappings
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
