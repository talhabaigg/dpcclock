'use client';

import { cn } from '@/lib/utils';
import { UploadCloud } from 'lucide-react';
import * as React from 'react';

export interface DropzoneProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrop' | 'onError'> {
    /** Called with the accepted files once dropped or picked. */
    onDrop: (files: File[]) => void;
    /** `accept` attribute for the underlying file input, e.g. "image/*". */
    accept?: string;
    /** Allow selecting more than one file. Defaults to false. */
    multiple?: boolean;
    /** Maximum file size in bytes. Files larger than this are rejected. */
    maxSize?: number;
    disabled?: boolean;
    /** Surfaced when a dropped file fails validation (type / size). */
    onError?: (message: string) => void;
    /** Primary call-to-action line. */
    label?: string;
    /** Secondary hint line (e.g. "PNG or JPG up to 50MB"). */
    hint?: string;
}

function matchesAccept(file: File, accept?: string): boolean {
    if (!accept) return true;
    return accept.split(',').some((raw) => {
        const token = raw.trim();
        if (!token) return false;
        if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -1));
        if (token.startsWith('.')) return file.name.toLowerCase().endsWith(token.toLowerCase());
        return file.type === token;
    });
}

export function Dropzone({
    onDrop,
    accept,
    multiple = false,
    maxSize,
    disabled,
    onError,
    label = 'Drag & drop, or click to upload',
    hint,
    className,
    ...props
}: DropzoneProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);

        for (const file of files) {
            if (!matchesAccept(file, accept)) {
                onError?.(`"${file.name}" is not an accepted file type.`);
                return;
            }
            if (maxSize && file.size > maxSize) {
                onError?.(`"${file.name}" is larger than the ${Math.round(maxSize / 1024 / 1024)}MB limit.`);
                return;
            }
        }

        onDrop(multiple ? files : files.slice(0, 1));
    };

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={() => !disabled && inputRef.current?.click()}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onDragOver={(e) => {
                e.preventDefault();
                if (!disabled) setDragging(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                setDragging(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!disabled) handleFiles(e.dataTransfer.files);
            }}
            className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
                'hover:bg-muted/60 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                dragging ? 'border-primary bg-primary/5' : 'border-input bg-muted/30',
                disabled && 'pointer-events-none opacity-60',
                className,
            )}
            {...props}
        >
            <span className="bg-background text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full border">
                <UploadCloud className="h-5 w-5" />
            </span>
            <div className="space-y-0.5">
                <div className="text-foreground text-sm font-medium">{label}</div>
                {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={disabled}
                onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = '';
                }}
                className="hidden"
            />
        </div>
    );
}
