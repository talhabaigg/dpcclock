/**
 * Forecast Notes Section Component
 *
 * PURPOSE:
 * Provides an expandable section for adding notes to a labour forecast.
 * Notes can include assumptions, risks, or information for reviewers.
 *
 * FEATURES:
 * - Collapsible section to save space when not in use
 * - Preview of notes when collapsed
 * - Disabled when forecast is locked (submitted/approved/rejected)
 * - Notes are saved along with the forecast data
 * - AI-powered rich text editor (TipTap) with formatting and AI actions
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useMemo } from 'react';

interface ForecastNotesSectionProps {
    notes: string;
    onNotesChange: (notes: string) => void;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    isEditingLocked: boolean;
}

function getPlainPreview(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.trim();
}

export const ForecastNotesSection = ({ notes, onNotesChange, expanded, onExpandedChange, isEditingLocked }: ForecastNotesSectionProps) => {
    const previewText = useMemo(() => getPlainPreview(notes), [notes]);

    return (
        <div className="mb-4">
            <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs transition-colors">
                <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => onExpandedChange(!expanded)}
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Forecast Notes</span>
                        {previewText && !expanded && (
                            <span className="max-w-md truncate text-xs text-muted-foreground">
                                — {previewText.substring(0, 60)}
                                {previewText.length > 60 ? '...' : ''}
                            </span>
                        )}
                    </div>
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>

                {expanded && (
                    <div className="border-t bg-background px-4 py-3">
                        {isEditingLocked ? (
                            <div
                                className="prose prose-sm max-w-none rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground dark:prose-invert"
                                dangerouslySetInnerHTML={{ __html: notes || '<p class="italic opacity-60">No notes</p>' }}
                            />
                        ) : (
                            <AiRichTextEditor
                                content={notes}
                                onChange={onNotesChange}
                                placeholder="Add notes about this forecast (key assumptions, risks, notes for reviewers...)"
                            />
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                            {isEditingLocked ? 'Forecast is locked — cannot edit notes' : 'Notes are saved when you click Save'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
