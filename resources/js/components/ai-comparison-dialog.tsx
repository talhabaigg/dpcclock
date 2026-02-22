import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { AIComparisonResult, Revision } from '@/types/takeoff';

type AIComparisonDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    revisions: Revision[];
    drawingA: string;
    onDrawingAChange: (id: string) => void;
    drawingB: string;
    onDrawingBChange: (id: string) => void;
    comparing: boolean;
    result: AIComparisonResult | null;
    selectedChanges: Set<number>;
    customPrompt: string;
    onCustomPromptChange: (prompt: string) => void;
    savingObservations: boolean;
    onCompare: () => void;
    onToggleChange: (index: number) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onSaveAsObservations: () => void;
    onRegenerate: () => void;
};

export default function AIComparisonDialog({
    open,
    onOpenChange,
    revisions,
    drawingA,
    onDrawingAChange,
    drawingB,
    onDrawingBChange,
    comparing,
    result,
    selectedChanges,
    customPrompt,
    onCustomPromptChange,
    savingObservations,
    onCompare,
    onToggleChange,
    onSelectAll,
    onDeselectAll,
    onSaveAsObservations,
    onRegenerate,
}: AIComparisonDialogProps) {
    const revisionLabel = (rev: Revision) =>
        `Rev ${rev.revision_number || rev.revision || '?'} - ${rev.drawing_title || rev.drawing_number || 'Drawing ' + rev.id}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        AI Drawing Comparison
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs">Older Revision (A)</Label>
                            <Select value={drawingA} onValueChange={onDrawingAChange}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select revision" />
                                </SelectTrigger>
                                <SelectContent>
                                    {revisions.map((rev) => (
                                        <SelectItem key={rev.id} value={String(rev.id)} disabled={String(rev.id) === drawingB}>
                                            {revisionLabel(rev)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Newer Revision (B)</Label>
                            <Select value={drawingB} onValueChange={onDrawingBChange}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select revision" />
                                </SelectTrigger>
                                <SelectContent>
                                    {revisions.map((rev) => (
                                        <SelectItem key={rev.id} value={String(rev.id)} disabled={String(rev.id) === drawingA}>
                                            {revisionLabel(rev)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button onClick={onCompare} disabled={comparing || !drawingA || !drawingB} className="w-full">
                        {comparing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing with AI...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Compare Revisions
                            </>
                        )}
                    </Button>

                    {/* Results */}
                    {result && (
                        <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
                            {result.summary && (
                                <div>
                                    <h4 className="mb-1 text-sm font-medium">Summary</h4>
                                    <p className="text-muted-foreground text-sm">{result.summary}</p>
                                </div>
                            )}

                            {result.confidence && (
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs">Confidence:</span>
                                    <Badge
                                        variant={
                                            result.confidence === 'high'
                                                ? 'default'
                                                : result.confidence === 'medium'
                                                  ? 'secondary'
                                                  : 'outline'
                                        }
                                        className="text-xs"
                                    >
                                        {result.confidence}
                                    </Badge>
                                </div>
                            )}

                            {result.changes.length > 0 && (
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <h4 className="text-sm font-medium">
                                            Changes Detected ({result.changes.length})
                                            {selectedChanges.size > 0 && (
                                                <span className="text-muted-foreground ml-2 text-xs">({selectedChanges.size} selected)</span>
                                            )}
                                        </h4>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-7 text-xs">
                                                Select All
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={onDeselectAll}
                                                className="h-7 text-xs"
                                                disabled={selectedChanges.size === 0}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-60 space-y-2 overflow-y-auto">
                                        {result.changes.map((change, index) => (
                                            <div
                                                key={index}
                                                className={`bg-background cursor-pointer rounded border p-3 text-sm transition-colors ${selectedChanges.has(index) ? 'border-primary bg-primary/5' : ''}`}
                                                onClick={() => onToggleChange(index)}
                                            >
                                                <div className="mb-1 flex items-center gap-2">
                                                    <Checkbox
                                                        checked={selectedChanges.has(index)}
                                                        onCheckedChange={() => onToggleChange(index)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-4 w-4"
                                                    />
                                                    <Badge variant="outline" className="text-xs capitalize">
                                                        {change.type}
                                                    </Badge>
                                                    <Badge
                                                        variant={
                                                            change.impact === 'high'
                                                                ? 'destructive'
                                                                : change.impact === 'medium'
                                                                  ? 'default'
                                                                  : 'secondary'
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {change.impact} impact
                                                    </Badge>
                                                    {change.potential_change_order && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Potential CO
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-muted-foreground ml-6">{change.description}</p>
                                                {change.location && (
                                                    <p className="text-muted-foreground mt-1 ml-6 text-xs">
                                                        <span className="font-medium">Location:</span> {change.location}
                                                    </p>
                                                )}
                                                {change.reason && (
                                                    <p className="mt-1 ml-6 text-xs text-amber-600">
                                                        <span className="font-medium">CO Reason:</span> {change.reason}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Save as Observations Button */}
                                    <Button
                                        onClick={onSaveAsObservations}
                                        disabled={savingObservations || selectedChanges.size === 0}
                                        className="mt-3 w-full"
                                        variant="default"
                                    >
                                        {savingObservations ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving Observations...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Save {selectedChanges.size > 0 ? `${selectedChanges.size} ` : ''}as Observations
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {result.notes && (
                                <div>
                                    <h4 className="mb-1 text-sm font-medium">Notes</h4>
                                    <p className="text-muted-foreground text-xs">{result.notes}</p>
                                </div>
                            )}

                            {/* Regenerate Section */}
                            <div className="border-t pt-4">
                                <h4 className="mb-2 text-sm font-medium">Refine Analysis</h4>
                                <p className="text-muted-foreground mb-2 text-xs">Add additional instructions to refine the AI analysis:</p>
                                <Textarea
                                    value={customPrompt}
                                    onChange={(e) => onCustomPromptChange(e.target.value)}
                                    placeholder="E.g., Focus more on dimensional changes, ignore annotation updates..."
                                    className="mb-2 min-h-[60px] text-sm"
                                />
                                <Button onClick={onRegenerate} disabled={comparing} variant="outline" className="w-full">
                                    {comparing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Regenerating...
                                        </>
                                    ) : (
                                        <>
                                            <RotateCcw className="mr-2 h-4 w-4" />
                                            Regenerate with Instructions
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
