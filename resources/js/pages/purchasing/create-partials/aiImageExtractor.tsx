import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CircleX, FileImage, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import { OpenAI } from 'openai';
import { useEffect, useMemo, useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { toast } from 'sonner';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result?.toString() || '';
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
    });
};

const extractLineItems = async (
    file: File | null,
    projectId: string,
    setRowData: (data: any[]) => void,
    setLoading: (loading: boolean) => void,
) => {
    if (!file) return toast.error('Please upload a file first.');
    if (!projectId) return toast.error('Please select a project first.');

    setLoading(true);

    try {
        const base64 = await fileToBase64(file);
        const openai = new OpenAI({
            apiKey: import.meta.env.VITE_OPEN_AI_API_KEY,
            dangerouslyAllowBrowser: true,
        });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Please extract all line items from this quotation image. Return the result as a JSON array of objects, even if only a single line item is found. Each object must include the following fields: code, description, qty, and unit_cost (without a $ sign). Prioritise ex-GST pricing over incl-GST where both are available. If a non-standard unit of measure is used, calculate unit_cost by dividing the total cost by the quantity.',
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 10000,
        });

        let content = response.choices[0].message.content || '';
        content = content
            .trim()
            .replace(/^```(?:json)?/, '')
            .replace(/```$/, '');

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            toast.error('Failed to parse extracted data. The AI response was not valid JSON — please try again.');
            return;
        }

        if (!Array.isArray(parsed)) {
            toast.error('Extracted data is not in the expected format. Please try again.');
            return;
        }

        const rowDataMapped = await Promise.all(
            parsed.map(async (item: any, index: number) => {
                let loadedItem = null;
                try {
                    const res = await fetch(`/material-items/code/${item.code}/${projectId}`);
                    if (res.ok) loadedItem = await res.json();
                } catch {
                    // Cost code lookup failed — continue without it
                }

                return {
                    code: item.code,
                    description: item.description,
                    qty: parseFloat(item.qty),
                    unit_cost: parseFloat(item.unit_cost),
                    total_cost: parseFloat(item.unit_cost) * parseFloat(item.qty),
                    cost_code: loadedItem?.cost_code || '',
                    price_list: '',
                    serial_number: index + 1,
                };
            }),
        );

        setRowData(rowDataMapped);
        toast.success('Line items extracted successfully', {
            description: `Extracted ${rowDataMapped.length} items from quote.`,
        });
    } catch (error: any) {
        toast.error('Failed to extract line items', {
            description: error?.message || 'An unexpected error occurred.',
        });
    } finally {
        setLoading(false);
    }
};

interface AiImageExtractorProps {
    setFile: (file: File | null) => void;
    file: File | null;
    setPastingItems: (pasting: boolean) => void;
    projectId: string;
    setRowData: (data: any[]) => void;
}

const AiImageExtractor = ({ setFile, file, setPastingItems, projectId, setRowData }: AiImageExtractorProps) => {
    const [loading, setLoading] = useState(false);
    const loadingMessages = [
        'Reading your image...',
        'Extracting text with AI...',
        'Looking up cost codes...',
        'Finalizing data...',
    ];
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);

    useEffect(() => {
        if (!loading) {
            setLoadingTextIndex(0);
            return;
        }
        const interval = setInterval(() => {
            setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [loading]);

    const previewUrl = useMemo(() => {
        if (!file) return null;
        const url = URL.createObjectURL(file);
        return url;
    }, [file]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    return (
        <div className="border-border/60 rounded-xl border p-4">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium">AI Quote Extractor</h3>
                    <p className="text-muted-foreground text-xs">Upload a quotation image to extract line items</p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                            <HelpCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">How to use</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>How to Use AI Quote Extractor</DialogTitle>
                            <DialogDescription>Follow these steps to extract line items from supplier quotes</DialogDescription>
                        </DialogHeader>
                        <ol className="text-sm mt-4 space-y-3">
                            <li className="flex gap-3">
                                <span className="text-muted-foreground font-medium shrink-0">1.</span>
                                <div>
                                    <p className="font-medium">Crop line items from the quote</p>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        Screenshot or crop the section with the line items table. Include headers like code, description, qty, and price.
                                    </p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-muted-foreground font-medium shrink-0">2.</span>
                                <div>
                                    <p className="font-medium">Upload the image</p>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        Drag and drop into the upload area, or click to browse. Supports PNG, JPG, JPEG.
                                    </p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-muted-foreground font-medium shrink-0">3.</span>
                                <div>
                                    <p className="font-medium">Verify before submitting</p>
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                        Review the extracted data in the grid. AI may misread values — double-check quantities and prices.
                                    </p>
                                </div>
                            </li>
                        </ol>
                        <p className="text-muted-foreground mt-4 text-xs">
                            For best results, ensure the image is clear and text is readable.
                        </p>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="border-border/60 flex min-h-[100px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6">
                    <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                    <span className="text-muted-foreground text-sm">
                        {loadingMessages[loadingTextIndex]}
                    </span>
                </div>
            ) : (
                <div className="space-y-3">
                    {!file ? (
                        <Dropzone
                            onDrop={(acceptedFiles: File[]) => {
                                if (acceptedFiles.length > 0) {
                                    setFile(acceptedFiles[0]);
                                }
                            }}
                        />
                    ) : (
                        <div className="border-border/60 flex items-center gap-3 rounded-lg border p-3">
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border">
                                {previewUrl && (
                                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <FileImage className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                    <Label className="truncate text-sm">{file.name}</Label>
                                </div>
                                <p className="text-muted-foreground mt-0.5 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                                onClick={() => setFile(null)}
                            >
                                <CircleX className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                        <Button
                            onClick={() => extractLineItems(file, projectId, setRowData, setLoading)}
                            disabled={!file}
                            size="sm"
                        >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                            Extract with AI
                        </Button>
                        <p className="text-muted-foreground text-xs">
                            <span className="hidden sm:inline">AI features are experimental and may require verification</span>
                            <span className="sm:hidden">Results may need verification</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export { AiImageExtractor };
