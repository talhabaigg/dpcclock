import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FinalizeStep } from './steps/finalize-step';
import { MappingStep } from './steps/mapping-step';
import { PreviewStep } from './steps/preview-step';
import { UploadStep } from './steps/upload-step';
import type { ImporterWizardProps, ImporterWizardTriggerProps, WizardStep } from './types';
import { useImporter } from './use-importer';

const STEPS: { num: WizardStep; label: string }[] = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Map Columns' },
    { num: 3, label: 'Preview' },
    { num: 4, label: 'Import' },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
    return (
        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Import steps">
            {STEPS.map((s, i) => {
                const isCompleted = s.num < currentStep;
                const isCurrent = s.num === currentStep;
                const isPending = s.num > currentStep;

                return (
                    <div key={s.num} className="flex items-center">
                        {/* Step circle */}
                        <div
                            className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                                isCompleted && 'bg-primary text-primary-foreground',
                                isCurrent && 'bg-primary text-primary-foreground ring-primary/25 ring-4',
                                isPending && 'bg-muted text-muted-foreground',
                            )}
                            aria-current={isCurrent ? 'step' : undefined}
                        >
                            {isCompleted ? <Check className="h-4 w-4" /> : s.num}
                        </div>
                        {/* Step label */}
                        <span
                            className={cn(
                                'ml-1.5 hidden text-sm font-medium whitespace-nowrap sm:inline',
                                isCurrent && 'text-foreground',
                                isCompleted && 'text-primary',
                                isPending && 'text-muted-foreground',
                            )}
                        >
                            {s.label}
                        </span>
                        {/* Connector line */}
                        {i < STEPS.length - 1 && (
                            <div className={cn('mx-2 h-px w-6 sm:w-10', isCompleted ? 'bg-primary' : 'bg-border')} />
                        )}
                    </div>
                );
            })}
        </nav>
    );
}

export function ImporterWizardDialog({ open, onOpenChange, title, description, columns, validateRow, onSubmit, serverValidateUrl }: ImporterWizardProps) {
    const importer = useImporter({ columns, validateRow, onSubmit, serverValidateUrl });

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            importer.reset();
        }
        onOpenChange(newOpen);
    };

    const handleClose = () => {
        importer.reset();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="flex h-[calc(100vh-2rem)] min-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0"
                hideCloseButton={importer.isSubmitting}
            >
                {/* Header - pinned top */}
                <div className="bg-background sticky top-0 z-10 flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                    <DialogHeader className="min-w-0 space-y-0">
                        <DialogTitle className="truncate">{title || 'Import Data'}</DialogTitle>
                        {description && <DialogDescription className="truncate">{description}</DialogDescription>}
                    </DialogHeader>
                    <StepIndicator currentStep={importer.step} />
                </div>

                {/* Step Content - scrollable middle */}
                <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                    {importer.step === 1 && (
                        <UploadStep
                            parsedFile={importer.parsedFile}
                            onFile={async (file) => {
                                try {
                                    await importer.handleFile(file);
                                } catch (err) {
                                    toast.error(err instanceof Error ? err.message : 'Failed to parse file');
                                }
                            }}
                        />
                    )}
                    {importer.step === 2 && importer.parsedFile && (
                        <MappingStep
                            columns={columns}
                            parsedFile={importer.parsedFile}
                            mappings={importer.mappings}
                            onSetMapping={importer.setMapping}
                            onClearMapping={importer.clearMapping}
                            onResetAutoMap={importer.runAutoMap}
                        />
                    )}
                    {importer.step === 3 && (
                        <PreviewStep
                            columns={columns}
                            mappedRows={importer.mappedRows}
                            validCount={importer.validCount}
                            warningCount={importer.warningCount}
                            errorCount={importer.errorCount}
                            isValidating={importer.isValidating}
                            hasServerValidation={!!serverValidateUrl}
                            onCellUpdate={importer.updateCell}
                            onRevalidate={importer.runServerValidation}
                        />
                    )}
                    {importer.step === 4 && (
                        <FinalizeStep
                            totalRows={importer.mappedRows.length}
                            validCount={importer.validCount}
                            warningCount={importer.warningCount}
                            errorCount={importer.errorCount}
                            isSubmitting={importer.isSubmitting}
                            submitComplete={importer.submitComplete}
                            submitError={importer.submitError}
                            onSubmit={importer.submit}
                            onClose={handleClose}
                        />
                    )}
                </div>

                {/* Footer - pinned bottom, always visible */}
                {!importer.submitComplete && (
                    <div className="bg-background sticky bottom-0 z-10 flex shrink-0 items-center justify-between border-t px-4 py-3 sm:px-6">
                        <div>
                            {importer.step > 1 && !importer.isSubmitting && (
                                <Button variant="outline" onClick={importer.goBack}>
                                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div>
                            {importer.step < 4 && (
                                <Button onClick={importer.goNext} disabled={!importer.canAdvance}>
                                    Next
                                    <ArrowRight className="ml-1.5 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function ImporterWizardTrigger({ trigger, ...config }: ImporterWizardTriggerProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div onClick={() => setOpen(true)} className="inline-flex">
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Upload className="mr-1 h-4 w-4" />
                        Import
                    </Button>
                )}
            </div>
            <ImporterWizardDialog open={open} onOpenChange={setOpen} {...config} />
        </>
    );
}
