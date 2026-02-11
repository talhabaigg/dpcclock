import { FileSpreadsheet } from 'lucide-react';
import Dropzone from 'shadcn-dropzone';
import type { ParsedFileData } from '../types';

interface UploadStepProps {
    parsedFile: ParsedFileData | null;
    onFile: (file: File) => Promise<void>;
}

export function UploadStep({ parsedFile, onFile }: UploadStepProps) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="w-full max-w-lg">
                <Dropzone
                    onDrop={(acceptedFiles) => {
                        if (acceptedFiles.length > 0) {
                            onFile(acceptedFiles[0]);
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
            </div>

            {parsedFile && (
                <div className="bg-muted/50 flex items-center gap-3 rounded-lg border px-4 py-3">
                    <FileSpreadsheet className="text-primary h-5 w-5" />
                    <div className="text-sm">
                        <p className="font-medium">{parsedFile.fileName}</p>
                        <p className="text-muted-foreground">
                            {parsedFile.rows.length} rows, {parsedFile.headers.length} columns
                        </p>
                    </div>
                </div>
            )}

            <p className="text-muted-foreground max-w-md text-center text-sm">
                Format columns to text or number before copying data to avoid Excel converting values to dates or scientific notation.
            </p>
        </div>
    );
}
