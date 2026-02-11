import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedFileData } from '../types';

function parseCsv(file: File): Promise<ParsedFileData> {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            transform: (value) => {
                if (typeof value === 'string') return value.trim();
                return value == null ? '' : String(value);
            },
            complete: (results) => {
                const headers = results.meta.fields ?? [];
                const rows = (results.data as Record<string, string>[]) ?? [];
                resolve({ headers, rows, fileName: file.name });
            },
            error: (error) => {
                reject(new Error(`Failed to parse CSV: ${error.message}`));
            },
        });
    });
}

function parseExcel(file: File): Promise<ParsedFileData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result as ArrayBuffer;
                const workbook = XLSX.read(data, {
                    type: 'array',
                    cellDates: false,
                    raw: false,
                });

                const sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];

                const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
                    defval: '',
                    raw: false,
                });

                const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

                const normalisedRows: Record<string, string>[] = rows.map((row) => {
                    const obj: Record<string, string> = {};
                    headers.forEach((h) => {
                        const v = row[h];
                        obj[h] = v == null ? '' : String(v).trim();
                    });
                    return obj;
                });

                resolve({ headers, rows: normalisedRows, fileName: file.name });
            } catch (err) {
                reject(new Error(`Failed to parse Excel file: ${err instanceof Error ? err.message : String(err)}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read the file'));
        };

        reader.readAsArrayBuffer(file);
    });
}

export function parseFile(file: File): Promise<ParsedFileData> {
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
        return parseCsv(file);
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        return parseExcel(file);
    }

    return Promise.reject(new Error('Unsupported file type. Please upload a CSV or Excel file.'));
}
