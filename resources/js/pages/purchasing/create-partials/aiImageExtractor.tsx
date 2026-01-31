import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CheckCircle2, CircleX, Crop, FileImage, HelpCircle, Sparkles, Upload, Wand2 } from 'lucide-react';
import { OpenAI } from 'openai';
import { useEffect, useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { toast } from 'sonner';
const extractLineItems = async (file, setPastingItems, projectId, setRowData, setLoading) => {
    if (!file) return alert('Please upload a file first.');
    if (!projectId) return alert('Please select a project first.');

    const base64 = await fileToBase64(file);
    const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPEN_AI_API_KEY,
        dangerouslyAllowBrowser: true,
    });
    // setPastingItems(true);
    setLoading(true);
    const response = await openai.chat.completions.create({
        model: 'gpt-4o', // or 'gpt-4-vision-preview'
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

    // ✅ Remove triple backticks and "json" if present
    content = content
        .trim()
        .replace(/^```(?:json)?/, '')
        .replace(/```$/, '');

    // ✅ Try to parse
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (error) {
        alert('Failed to parse extracted data. Please try again. Error: ' + error.message);
        return alert('Could not parse extracted data. Please try again.');
    }

    const generateCSV = (parsed) => {
        const header = 'code,description,qty,unit_cost';
        const rows = parsed.map((item) => {
            return `${item.code},${item.description},${item.qty},${item.unit_cost}`;
        });
        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'extracted_line_items.csv');
        document.body.appendChild(link);
        link.click();
    };
    if (!Array.isArray(parsed)) {
        return alert('Extracted data is not in the expected format. Please try again.');
    }

    generateCSV(parsed);

    const rowDataMapped = await Promise.all(
        parsed.map(async (item, index) => {
            const locationId = projectId; // Ensure this exists in scope
            let loadedItem = null;

            try {
                const res = await fetch(`/material-items/code/${item.code}/${locationId}`);
                if (res.ok) loadedItem = await res.json();
            } catch (err) {
                alert(`Failed to fetch item with code ${item.code}. Please check the code and try again. Error: ${err.message}`);
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
    // setPastingItems(false);
    setLoading(false);
    toast.success('Line items extracted successfully using AI', {
        description: `Extracted ${rowDataMapped.length} items.`,
    });
};
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result?.toString() || '';
            resolve(result.split(',')[1]); // Get only base64 part
        };
        reader.onerror = reject;
    });
};

const AiImageExtractor = ({ setFile, file, setPastingItems, projectId, setRowData }) => {
    const [loading, setLoading] = useState(false);
    const loadingMessages = [
        'Reading your image...',
        'Using AI to extract text...',
        'Checking database to bring cost codes...',
        'Finalizing data...',
    ];
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);
    const [animateOut, setAnimateOut] = useState(false);
    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setAnimateOut(true);
            setTimeout(() => {
                setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length);
                setAnimateOut(false);
            }, 300);
        }, 2000);
        return () => clearInterval(interval);
    }, [loading]);

    return (
        <div className="group rounded-xl border border-border/60 bg-gradient-to-br from-violet-500/5 via-background to-purple-500/5 p-4 transition-all hover:border-violet-500/30 hover:shadow-md">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                        <Wand2 className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">AI Quote Extractor</h3>
                        <p className="text-xs text-muted-foreground">Upload a quotation image to extract line items</p>
                    </div>
                </div>

                {/* How to Use Dialog */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">How to use</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Wand2 className="h-5 w-5 text-violet-500" />
                                How to Use AI Quote Extractor
                            </DialogTitle>
                            <DialogDescription>
                                Follow these simple steps to extract line items from supplier quotes
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-6">
                            {/* Step 1 */}
                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 ring-1 ring-blue-500/20">
                                    <Crop className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">1</span>
                                        <h4 className="font-semibold">Crop Line Items from Quote</h4>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Take a screenshot or crop the section of the supplier quote that contains the line items table. Include headers like code, description, qty, and price.
                                    </p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 ring-1 ring-violet-500/20">
                                    <Upload className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">2</span>
                                        <h4 className="font-semibold">Upload File or Screenshot</h4>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Drag and drop your image into the upload area, or click to browse. Supported formats: PNG, JPG, JPEG.
                                    </p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-green-600/10 ring-1 ring-emerald-500/20">
                                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">3</span>
                                        <h4 className="font-semibold">Verify Before Submitting</h4>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Review the extracted data in the grid. AI may occasionally misread values - double-check quantities and prices before submitting your requisition.
                                    </p>
                                </div>
                            </div>

                            {/* Tip */}
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                    <strong>Tip:</strong> For best results, ensure the image is clear and the text is readable. Avoid blurry or low-resolution screenshots.
                                </p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex min-h-[120px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 p-6">
                    {/* Animated dots */}
                    <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-500" />
                    </div>
                    <span
                        key={loadingTextIndex}
                        className={`text-sm font-medium text-violet-600 dark:text-violet-400 transition-all duration-300 ${
                            animateOut ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
                        }`}
                    >
                        {loadingMessages[loadingTextIndex]}
                    </span>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Dropzone */}
                    {!file ? (
                        <Dropzone
                            onDrop={(acceptedFiles: File[]) => {
                                if (acceptedFiles.length > 0) {
                                    setFile(acceptedFiles[0]);
                                }
                            }}
                        />
                    ) : (
                        /* File Preview */
                        <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-3">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt="Preview"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <FileImage className="h-4 w-4 text-muted-foreground" />
                                    <Label className="truncate text-sm font-medium">{file?.name}</Label>
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setFile(null)}
                            >
                                <CircleX className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {/* Action Row */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Button
                            onClick={() => extractLineItems(file, setPastingItems, projectId, setRowData, setLoading)}
                            disabled={!file}
                            className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
                        >
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            Extract with AI
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            <span className="hidden sm:inline">AI features are experimental and may require verification</span>
                            <span className="sm:hidden">Results may require verification</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export { AiImageExtractor };
