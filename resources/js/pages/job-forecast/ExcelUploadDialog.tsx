/**
 * Excel Upload/Download Dialog for Forecast Data
 * Allows users to download template, edit in Excel, and upload back
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Download, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { GridRow } from './types';

interface ExcelUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    costGridData: GridRow[];
    displayMonths: string[];
    forecastMonths: string[];
    onImportData: (data: { costItem: string; percentages: Record<string, number> }[]) => void;
}

export function ExcelUploadDialog({
    open,
    onOpenChange,
    costGridData,
    displayMonths,
    forecastMonths,
    onImportData,
}: ExcelUploadDialogProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatMonthHeader = (m: string) => {
        const date = new Date(`${m}-01T00:00:00`);
        return date.toLocaleString(undefined, { month: 'short', year: '2-digit' });
    };

    const handleDownloadTemplate = () => {
        // Prepare data for Excel
        const rows: any[] = [];

        // Header row
        const headers = [
            'Cost Item',
            'Description',
            'Budget',
            'Actuals To Date',
            'Remaining $',
            ...forecastMonths.map(formatMonthHeader),
        ];
        rows.push(headers);

        // Add instruction row
        const instructions = [
            '↓ Enter cumulative % of budget in the forecast columns →',
            '',
            '',
            '',
            '',
            ...forecastMonths.map(() => '← % →'),
        ];
        rows.push(instructions);

        // Data rows
        costGridData.forEach((row) => {
            const budget = Number(row.budget) || 0;

            // Calculate actuals to date
            const actualsToDate = displayMonths.reduce((sum, m) => {
                return sum + (Number(row[m]) || 0);
            }, 0);

            const remaining = budget - actualsToDate;

            // Calculate existing forecast cumulative percentages
            const forecastPercentages = forecastMonths.map((month) => {
                if (budget === 0) return '';

                // Check for forecast_ prefix (current month scenario)
                const fieldName = row[`forecast_${month}`] !== undefined ? `forecast_${month}` : month;
                const monthValue = Number(row[fieldName]) || 0;

                // Calculate cumulative amount up to this month
                let cumulative = actualsToDate;

                // Add all forecast values up to and including this month
                forecastMonths.forEach((m) => {
                    if (m > month) return; // Stop when we pass the target month

                    const fname = row[`forecast_${m}`] !== undefined ? `forecast_${m}` : m;
                    cumulative += Number(row[fname]) || 0;
                });

                // Convert to percentage of budget
                const percentage = (cumulative / budget) * 100;
                return percentage > 0 ? Math.round(percentage * 10) / 10 : ''; // Round to 1 decimal
            });

            const dataRow = [
                row.cost_item,
                row.cost_item_description || '',
                budget,
                actualsToDate,
                remaining,
                ...forecastPercentages,
            ];
            rows.push(dataRow);
        });

        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Set column widths
        ws['!cols'] = [
            { wch: 12 }, // Cost Item
            { wch: 30 }, // Description
            { wch: 15 }, // Budget
            { wch: 15 }, // Actuals To Date
            { wch: 15 }, // Remaining $
            ...forecastMonths.map(() => ({ wch: 10 })), // Forecast months
        ];

        // Style the header row
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellAddress]) continue;
            ws[cellAddress].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: 'E0E0E0' } },
            };
        }

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Forecast Template');

        // Download file
        XLSX.writeFile(wb, 'forecast_template.xlsx');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            // Skip header and instruction rows (first 2 rows)
            const dataRows = jsonData.slice(2);

            // Parse the uploaded data
            const importedData: { costItem: string; percentages: Record<string, number> }[] = [];

            dataRows.forEach((row) => {
                if (!row[0]) return; // Skip empty rows

                const costItem = String(row[0]).trim();
                const percentages: Record<string, number> = {};

                // Forecast month percentages start at column 5 (index 5)
                forecastMonths.forEach((month, idx) => {
                    const cellValue = row[5 + idx];
                    if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                        const percentage = Number(cellValue);
                        if (!isNaN(percentage)) {
                            percentages[month] = percentage;
                        }
                    }
                });

                if (Object.keys(percentages).length > 0) {
                    importedData.push({ costItem, percentages });
                }
            });

            if (importedData.length === 0) {
                throw new Error('No valid data found in the uploaded file');
            }

            onImportData(importedData);
            onOpenChange(false);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            console.error('Error parsing Excel file:', err);
            setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Excel Import/Export</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Download Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Step 1: Download Template</Label>
                        <p className="text-muted-foreground text-sm">
                            Download the Excel template with your current cost items and budget information.
                        </p>
                        <Button onClick={handleDownloadTemplate} className="w-full" variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>
                    </div>

                    <div className="border-t" />

                    {/* Upload Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Step 2: Fill in Forecast Percentages</Label>
                        <p className="text-muted-foreground text-sm">
                            In Excel, enter the <strong>cumulative percentage of budget</strong> you want to reach by each forecast
                            month. For example, if you want to reach 50% of budget by February, enter 50 in the Feb column.
                        </p>
                    </div>

                    <div className="border-t" />

                    {/* Upload Section */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Step 3: Upload Completed File</Label>
                        <p className="text-muted-foreground text-sm">
                            Upload your completed Excel file. The forecast grid will be updated with the percentages you entered.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={uploading}
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full"
                            disabled={uploading}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {uploading ? 'Uploading...' : 'Upload Completed File'}
                        </Button>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                            <div className="flex items-start gap-2">
                                <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                <div>{error}</div>
                            </div>
                        </div>
                    )}

                    <div className="bg-muted rounded-md p-3 text-xs text-muted-foreground">
                        <strong>Note:</strong> After uploading, review the grid to ensure data was imported correctly, then
                        click "Save Forecast" to persist your changes.
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
