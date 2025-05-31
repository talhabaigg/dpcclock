import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CircleX, Sparkles } from 'lucide-react';
import { OpenAI } from 'openai';
import { useEffect, useState } from 'react';
import BeatLoader from 'react-spinners/BeatLoader';
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
                        text: 'Please extract all line items from this quotation image. Return the result as a JSON array of objects, even if only a single line item is found. Each object must include the following fields: code, description, qty, and unit_cost (without a $ sign). Prioritise ex-GST pricing over incl-GST where both are available. If a non-standard unit of measure is used, calculate unit_cost by dividing the total cost by the quantity. If any comment line found, include that as an object with description as the "comment - $lineValue", qty as 1, unit_cost as 0, and code as empty string.',
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
    console.log('Raw response:', content);

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
        console.error('Failed to parse JSON:', error);
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
                console.warn(`Lookup failed for code: ${item.code}`, err);
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
    console.log('Response:', response.choices[0].message.content);
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
        const interval = setInterval(() => {
            setAnimateOut(true); // trigger slide-out

            setTimeout(() => {
                setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length);
                setAnimateOut(false); // trigger slide-in
            }, 300); // duration of the "slide-out"
        }, 2000);

        return () => clearInterval(interval);
    }, []);
    return (
        <Card className="my-2 p-4">
            {loading ? (
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    <BeatLoader color="#4f46e5" size={24} />
                    <span
                        key={loadingTextIndex}
                        className={`text-muted-foreground inline-block transition-all duration-300 ${
                            animateOut ? '-translate-x-5 opacity-0' : 'translate-x-0 opacity-100'
                        }`}
                    >
                        {loadingMessages[loadingTextIndex]}
                    </span>
                </div>
            ) : (
                <>
                    <Dropzone
                        onDrop={(acceptedFiles: File[]) => {
                            if (acceptedFiles.length > 0) {
                                setFile(acceptedFiles[0]);
                            }
                        }}
                    />
                    <div className="flex w-full flex-col items-center justify-between gap-2 sm:flex-row md:flex-row">
                        <div className="flex w-full items-center justify-start gap-2 sm:justify-start">
                            <Button onClick={() => extractLineItems(file, setPastingItems, projectId, setRowData, setLoading)} disabled={!file}>
                                <Sparkles /> Extract with AI
                            </Button>
                            <span className="text-muted-foreground ml-2 hidden text-xs sm:block">
                                (Note that AI features are experimental and may not work as expected.)
                            </span>
                        </div>

                        {file && (
                            <div className="flex w-full items-center justify-start gap-0 sm:justify-end">
                                <div className="bg-muted mr-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded border">
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt="Preview"
                                        className="h-full w-full object-contain"
                                        style={{ aspectRatio: '1 / 1' }}
                                    />
                                </div>
                                <Label className="flex items-center justify-between gap-2">
                                    {file?.name}{' '}
                                    <span className="ml-4">
                                        <Button variant="outline" size="icon" onClick={() => setFile(null)}>
                                            <CircleX />
                                        </Button>
                                    </span>
                                </Label>
                            </div>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
};

export { AiImageExtractor };
