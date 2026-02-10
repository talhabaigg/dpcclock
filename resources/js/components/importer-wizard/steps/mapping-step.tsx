import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronDown, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import type { ColumnMapping, ImporterColumnDef, ParsedFileData } from '../types';

interface MappingStepProps {
    columns: ImporterColumnDef[];
    parsedFile: ParsedFileData;
    mappings: ColumnMapping;
    onSetMapping: (targetKey: string, sourceHeader: string) => void;
    onClearMapping: (targetKey: string) => void;
    onResetAutoMap: () => void;
}

const PREVIEW_COUNT = 10;

export function MappingStep({ columns, parsedFile, mappings, onSetMapping, onClearMapping, onResetAutoMap }: MappingStepProps) {
    const [activeField, setActiveField] = useState<string | null>(columns[0]?.key ?? null);

    const mappedCount = columns.filter((c) => !!mappings[c.key]).length;
    const activeMapping = activeField ? mappings[activeField] : null;
    const activeColumn = columns.find((c) => c.key === activeField);

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Sub-header */}
            <div className="shrink-0 border-b px-6 py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium">Review and confirm each mapping choice</h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onResetAutoMap} className="text-muted-foreground">
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset mappings
                    </Button>
                </div>
            </div>

            {/* Two-panel layout */}
            <div className="flex min-h-0 flex-1">
                {/* Left panel - mapping table */}
                <div className="flex flex-1 flex-col overflow-auto border-r">
                    {/* Column headers */}
                    <div className="bg-muted/40 sticky top-0 z-10 flex items-center border-b px-6 py-2 text-xs font-semibold tracking-wide uppercase">
                        <div className="w-[40%]">
                            <span className="text-muted-foreground">Incoming Fields</span>
                            <span className="text-muted-foreground ml-2 text-[10px] font-normal normal-case tracking-normal">
                                {mappedCount} of {columns.length}
                            </span>
                        </div>
                        <div className="w-[8%]" />
                        <div className="w-[52%]">
                            <span className="text-muted-foreground">Destination Fields</span>
                            <span className="text-muted-foreground ml-2 text-[10px] font-normal normal-case tracking-normal">
                                {mappedCount} of {columns.length}
                            </span>
                        </div>
                    </div>

                    {/* Mapping rows */}
                    {columns.map((col) => {
                        const mapped = mappings[col.key];
                        const isActive = activeField === col.key;

                        return (
                            <div
                                key={col.key}
                                className={cn(
                                    'flex cursor-pointer items-center border-b px-6 py-3.5 transition-colors',
                                    isActive ? 'bg-accent/50' : 'hover:bg-muted/30',
                                )}
                                onClick={() => setActiveField(col.key)}
                            >
                                {/* Incoming field (file header) */}
                                <div className="w-[40%] min-w-0">
                                    {mapped ? (
                                        <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                                            {mapped}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground text-sm italic">Not mapped</span>
                                    )}
                                </div>

                                {/* Arrow */}
                                <div className="flex w-[8%] justify-center">
                                    <ArrowRight className={cn(
                                        'h-4 w-4',
                                        mapped ? 'text-muted-foreground' : 'text-muted-foreground/30',
                                    )} />
                                </div>

                                {/* Destination field (target column) */}
                                <div className="flex w-[52%] min-w-0 items-center gap-2">
                                    <Select
                                        value={mapped || '__none__'}
                                        onValueChange={(value) => {
                                            if (value === '__none__') {
                                                onClearMapping(col.key);
                                            } else {
                                                onSetMapping(col.key, value);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus:ring-0">
                                            <span className="flex items-center gap-1.5 text-sm">
                                                {col.label}
                                                {col.required && <span className="text-destructive">*</span>}
                                                <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                                            </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">(None)</SelectItem>
                                            {parsedFile.headers.map((header) => (
                                                <SelectItem key={header} value={header}>
                                                    {header}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    {mapped && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClearMapping(col.key);
                                            }}
                                            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right panel - data preview */}
                <div className="w-[340px] shrink-0 overflow-auto lg:w-[400px]">
                    {activeField && activeMapping ? (
                        <div className="flex flex-col">
                            <div className="bg-muted/40 sticky top-0 border-b px-5 py-2">
                                <h4 className="text-sm font-medium">
                                    Data preview for{' '}
                                    <span className="font-semibold">{activeColumn?.label ?? activeField}</span>
                                </h4>
                            </div>
                            <div className="divide-y">
                                {parsedFile.rows.slice(0, PREVIEW_COUNT).map((row, i) => {
                                    const val = row[activeMapping];
                                    return (
                                        <div key={i} className="px-5 py-2.5 text-sm">
                                            {val || <span className="text-muted-foreground italic">empty</span>}
                                        </div>
                                    );
                                })}
                                {parsedFile.rows.length > PREVIEW_COUNT && (
                                    <div className="text-muted-foreground px-5 py-2.5 text-xs">
                                        +{parsedFile.rows.length - PREVIEW_COUNT} more rows
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
                            {activeField
                                ? 'Map a file column to see a data preview'
                                : 'Select a field to preview data'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
