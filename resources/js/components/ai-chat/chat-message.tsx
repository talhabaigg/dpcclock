'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Check, Copy, Download, FileText, RefreshCw, Sparkles, User } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from './types';

interface ChatMessageProps {
    message: ChatMessageType;
    isLatest?: boolean;
    onRegenerate?: () => void;
    showTimestamp?: boolean;
}

// Code block component with syntax highlighting and copy button
function CodeBlock({ language, children }: { language: string; children: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API failed
        }
    };

    return (
        <div className="group/code relative my-4 overflow-hidden rounded-lg border border-zinc-700">
            {/* Header with language and copy button */}
            <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
                <span className="text-xs font-medium text-zinc-400">{language || 'code'}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1.5 px-2 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <>
                            <Check className="size-3" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="size-3" />
                            Copy
                        </>
                    )}
                </Button>
            </div>
            {/* Code content with syntax highlighting */}
            <SyntaxHighlighter
                language={language || 'text'}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    background: '#1e1e1e',
                    borderRadius: 0,
                }}
                codeTagProps={{
                    style: {
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    },
                }}
                showLineNumbers={children.split('\n').length > 3}
                lineNumberStyle={{
                    minWidth: '2.5em',
                    paddingRight: '1em',
                    color: '#6b7280',
                    userSelect: 'none',
                }}
            >
                {children}
            </SyntaxHighlighter>
        </div>
    );
}

// Design-system chart tokens — uses CSS variables from --chart-1..5, extended for more datasets
const CHART_TOKENS = [
    'oklch(0.646 0.222 41.116)',  // chart-1: warm orange
    'oklch(0.6 0.118 184.704)',   // chart-2: teal
    'oklch(0.398 0.07 227.392)',  // chart-3: slate blue
    'oklch(0.828 0.189 84.429)',  // chart-4: gold
    'oklch(0.769 0.188 70.08)',   // chart-5: amber
    'oklch(0.627 0.265 303.9)',   // extended: purple
    'oklch(0.645 0.246 16.439)',  // extended: rose
    'oklch(0.55 0.15 150)',       // extended: emerald
];

interface ChartData {
    type: 'bar' | 'line' | 'pie';
    title?: string;
    unit?: string;
    labels?: string[];
    datasets?: Array<{
        label: string;
        data: number[];
        backgroundColor?: string | string[];
    }>;
    data?: Array<{ name: string; value: number }>;
}

function ChartBlock({ data }: { data: ChartData }) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const chartData = data.labels
        ? data.labels.map((label, index) => {
              const point: Record<string, string | number> = { name: label };
              data.datasets?.forEach((dataset) => {
                  point[dataset.label] = dataset.data[index] || 0;
              });
              return point;
          })
        : data.data || [];

    // Detect unit type from dataset labels, title, or explicit unit prop
    const chartUnit = (() => {
        if (data.unit) return data.unit;
        const allText = [
            data.title || '',
            ...(data.datasets?.map((ds) => ds.label) || []),
        ].join(' ');

        if (/\bhours\b|\bhrs\b|earned.hours|used.hours|projected.hours/i.test(allText)) return 'hours';
        if (/cost|revenue|spend|budget|\$|billing|invoice|amount|price/i.test(allText)) return 'currency';
        if (/%|percent|complete|progress/i.test(allText)) return 'percent';
        return 'number';
    })();

    const formatValue = (value: number) => {
        const abs = Math.abs(value);
        switch (chartUnit) {
            case 'hours':
                if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M hrs`;
                if (abs >= 1000) return `${(value / 1000).toFixed(1)}K hrs`;
                return `${Math.round(value).toLocaleString()} hrs`;
            case 'currency':
                if (abs >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                if (abs >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                return `$${Math.round(value).toLocaleString()}`;
            case 'percent':
                return `${value.toFixed(1)}%`;
            default:
                if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (abs >= 1000) return `${(value / 1000).toFixed(1)}K`;
                return value.toLocaleString();
        }
    };

    const getColor = (index: number, explicit?: string | string[]) =>
        (typeof explicit === 'string' && explicit) || CHART_TOKENS[index % CHART_TOKENS.length];

    const chartConfig: ChartConfig = {};
    data.datasets?.forEach((ds, i) => {
        chartConfig[ds.label] = { label: ds.label, color: getColor(i, ds.backgroundColor) };
    });
    data.data?.forEach((item, i) => {
        chartConfig[item.name] = { label: item.name, color: CHART_TOKENS[i % CHART_TOKENS.length] };
    });

    const handleDownload = useCallback(async () => {
        if (!chartRef.current || isDownloading) return;
        setIsDownloading(true);
        try {
            const svgElement = chartRef.current.querySelector('svg');
            if (!svgElement) { setIsDownloading(false); return; }

            const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
            const bbox = svgElement.getBoundingClientRect();
            clonedSvg.setAttribute('width', String(bbox.width));
            clonedSvg.setAttribute('height', String(bbox.height));

            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('width', '100%');
            bg.setAttribute('height', '100%');
            bg.setAttribute('fill', '#ffffff');
            clonedSvg.insertBefore(bg, clonedSvg.firstChild);

            const svgBlob = new Blob([new XMLSerializer().serializeToString(clonedSvg)], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const pad = 24;
                canvas.width = bbox.width + pad * 2;
                canvas.height = bbox.height + pad * 2;
                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, pad, pad);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${data.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'chart'}-${Date.now()}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }
                    }, 'image/png');
                }
                URL.revokeObjectURL(svgUrl);
                setIsDownloading(false);
            };

            img.onerror = () => { URL.revokeObjectURL(svgUrl); setIsDownloading(false); };
            img.src = svgUrl;
        } catch {
            setIsDownloading(false);
        }
    }, [data.title, isDownloading]);

    const truncateLabel = (label: string, max: number = 10) =>
        label.length <= max ? label : label.slice(0, max) + '\u2026';

    const tooltipFormatter = (value: unknown, name: unknown) => (
        <div className="flex flex-1 items-center justify-between gap-4">
            <span className="text-muted-foreground">{chartConfig[name as string]?.label ?? name}</span>
            <span className="font-mono font-medium tabular-nums">{formatValue(value as number)}</span>
        </div>
    );

    return (
        <div className="group/chart bg-card my-4 overflow-hidden rounded-xl border shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-1">
                {data.title && (
                    <h4 className="text-foreground text-sm font-semibold tracking-tight">{data.title}</h4>
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground -mr-1 size-8 opacity-0 transition-opacity group-hover/chart:opacity-100"
                            onClick={handleDownload}
                            disabled={isDownloading}
                        >
                            <Download className={cn('size-3.5', isDownloading && 'animate-pulse')} />
                            <span className="sr-only">Download as PNG</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Save as PNG</TooltipContent>
                </Tooltip>
            </div>

            {/* Chart */}
            <div ref={chartRef} className="px-2 pb-2">
                <ChartContainer config={chartConfig} className="aspect-auto h-[260px] w-full">
                    {data.type === 'bar' ? (
                        <BarChart data={chartData} barCategoryGap="25%">
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11 }}
                                angle={-40}
                                textAnchor="end"
                                height={60}
                                interval={0}
                                tickFormatter={(v) => truncateLabel(String(v))}
                            />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={formatValue} width={52} tick={{ fontSize: 11 }} />
                            <ChartTooltip content={<ChartTooltipContent formatter={tooltipFormatter} />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            {data.datasets?.map((ds, i) => (
                                <Bar
                                    key={ds.label}
                                    dataKey={ds.label}
                                    fill={getColor(i, ds.backgroundColor)}
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={48}
                                />
                            ))}
                        </BarChart>
                    ) : data.type === 'line' ? (
                        <LineChart data={chartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11 }}
                                angle={-40}
                                textAnchor="end"
                                height={60}
                                interval={0}
                                tickFormatter={(v) => truncateLabel(String(v))}
                            />
                            <YAxis tickLine={false} axisLine={false} tickFormatter={formatValue} width={52} tick={{ fontSize: 11 }} />
                            <ChartTooltip
                                content={<ChartTooltipContent formatter={tooltipFormatter} />}
                                cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            {data.datasets?.map((ds, i) => {
                                const color = getColor(i, ds.backgroundColor);
                                return (
                                    <Line
                                        key={ds.label}
                                        type="natural"
                                        dataKey={ds.label}
                                        stroke={color}
                                        strokeWidth={2}
                                        dot={{ fill: 'hsl(var(--background))', stroke: color, strokeWidth: 2, r: 3 }}
                                        activeDot={{ fill: color, stroke: 'hsl(var(--background))', strokeWidth: 2, r: 5 }}
                                    />
                                );
                            })}
                        </LineChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="45%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                nameKey="name"
                                strokeWidth={0}
                                label={({ name, percent, cx: pcx, cy: pcy, midAngle, outerRadius: oR }) => {
                                    if (percent < 0.03) return null;
                                    const RADIAN = Math.PI / 180;
                                    const r = oR + 20;
                                    const x = pcx + r * Math.cos(-midAngle * RADIAN);
                                    const y = pcy + r * Math.sin(-midAngle * RADIAN);
                                    return (
                                        <text
                                            x={x} y={y}
                                            fill="hsl(var(--muted-foreground))"
                                            textAnchor={x > pcx ? 'start' : 'end'}
                                            dominantBaseline="central"
                                            fontSize={11}
                                        >
                                            {`${truncateLabel(name, 10)} ${(percent * 100).toFixed(0)}%`}
                                        </text>
                                    );
                                }}
                                labelLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                            >
                                {chartData.map((_, i) => (
                                    <Cell key={`cell-${i}`} fill={CHART_TOKENS[i % CHART_TOKENS.length]} />
                                ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatValue(v as number)} />} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </PieChart>
                    )}
                </ChartContainer>
            </div>
        </div>
    );
}

// Try to parse chart data from a code block
function tryParseChartData(code: string): ChartData | null {
    try {
        const parsed = JSON.parse(code);
        if (parsed && (parsed.type === 'bar' || parsed.type === 'line' || parsed.type === 'pie')) {
            return parsed as ChartData;
        }
    } catch {
        // Not valid JSON or not chart data
    }
    return null;
}

// Generated image data interface
interface GeneratedImageData {
    success: boolean;
    image_url: string;
    revised_prompt?: string;
    size?: string;
    display_type: 'generated_image';
}

// Try to parse generated image data from a code block
function tryParseImageData(code: string): GeneratedImageData | null {
    try {
        const parsed = JSON.parse(code);
        if (parsed && parsed.display_type === 'generated_image' && parsed.image_url) {
            return parsed as GeneratedImageData;
        }
    } catch {
        // Not valid JSON or not image data
    }
    return null;
}

// Generated Image component with download button
function GeneratedImageBlock({ data }: { data: GeneratedImageData }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleDownload = useCallback(async () => {
        if (isDownloading) return;

        setIsDownloading(true);
        try {
            // Fetch the image
            const response = await fetch(data.image_url);
            const blob = await response.blob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `generated-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch { /* ignored */ } finally {
            setIsDownloading(false);
        }
    }, [data.image_url, isDownloading]);

    if (imageError) {
        return (
            <div className="border-border/50 bg-card text-muted-foreground my-4 rounded-xl border p-6 text-center">
                <p>Failed to load generated image</p>
                <a href={data.image_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline">
                    Open in new tab
                </a>
            </div>
        );
    }

    return (
        <div className="group/image border-border/50 bg-card my-4 rounded-xl border p-4 shadow-sm">
            {/* Header with prompt and download button */}
            <div className="mb-3 flex items-start justify-between gap-4">
                {data.revised_prompt && <p className="text-muted-foreground line-clamp-2 flex-1 text-xs italic">"{data.revised_prompt}"</p>}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-7 shrink-0 gap-1.5 px-2 text-xs opacity-0 transition-opacity group-hover/image:opacity-100"
                            onClick={handleDownload}
                            disabled={isDownloading}
                        >
                            <Download className={cn('size-3.5', isDownloading && 'animate-bounce')} />
                            {isDownloading ? 'Saving...' : 'Save'}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download image</TooltipContent>
                </Tooltip>
            </div>

            {/* Image container */}
            <div className="bg-muted/30 relative overflow-hidden rounded-lg">
                {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <div className="size-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                            <span className="text-muted-foreground text-xs">Loading image...</span>
                        </div>
                    </div>
                )}
                <img
                    src={data.image_url}
                    alt={data.revised_prompt || 'AI Generated Image'}
                    className={cn(
                        'h-auto max-h-[500px] w-full object-contain transition-opacity duration-300',
                        imageLoaded ? 'opacity-100' : 'opacity-0',
                    )}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                />
            </div>

            {/* Size badge */}
            {data.size && (
                <div className="mt-2 text-right">
                    <span className="text-muted-foreground bg-muted/50 rounded px-2 py-0.5 text-[10px]">{data.size}</span>
                </div>
            )}
        </div>
    );
}

// HTML chart component — renders AI-generated HTML/SVG with a download-as-image button
function HtmlChartBlock({ html }: { html: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);

    const handleDownload = useCallback(async () => {
        const el = containerRef.current;
        if (!el || downloading) return;
        setDownloading(true);

        try {
            // Find the SVG inside the rendered HTML
            const svg = el.querySelector('svg');
            if (svg) {
                // SVG-based download — clean and sharp
                const clone = svg.cloneNode(true) as SVGSVGElement;
                const bbox = svg.getBoundingClientRect();
                clone.setAttribute('width', String(bbox.width));
                clone.setAttribute('height', String(bbox.height));

                // Add white background
                const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bg.setAttribute('width', '100%');
                bg.setAttribute('height', '100%');
                bg.setAttribute('fill', '#ffffff');
                clone.insertBefore(bg, clone.firstChild);

                const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();

                img.onload = () => {
                    const pad = 16;
                    canvas.width = (bbox.width + pad * 2) * 2;
                    canvas.height = (bbox.height + pad * 2) * 2;
                    canvas.style.width = `${bbox.width + pad * 2}px`;
                    canvas.style.height = `${bbox.height + pad * 2}px`;
                    if (ctx) {
                        ctx.scale(2, 2);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, bbox.width + pad * 2, bbox.height + pad * 2);
                        ctx.drawImage(img, pad, pad, bbox.width, bbox.height);
                        canvas.toBlob((b) => {
                            if (b) {
                                const dl = URL.createObjectURL(b);
                                const a = document.createElement('a');
                                a.href = dl;
                                a.download = `chart-${Date.now()}.png`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(dl);
                            }
                        }, 'image/png');
                    }
                    URL.revokeObjectURL(url);
                    setDownloading(false);
                };
                img.onerror = () => { URL.revokeObjectURL(url); setDownloading(false); };
                img.src = url;
            }
        } catch {
            setDownloading(false);
        }
    }, [downloading]);

    return (
        <div className="group/htmlchart relative my-4 overflow-hidden">
            <div ref={containerRef} className="overflow-x-auto [&>*]:max-w-full [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: html }} />
            <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/htmlchart:opacity-100">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground size-8 backdrop-blur-sm"
                            onClick={handleDownload}
                            disabled={downloading}
                        >
                            <Download className={cn('size-3.5', downloading && 'animate-pulse')} />
                            <span className="sr-only">Download as image</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Save as image</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

// Report document component — renders AI-generated HTML with a PDF download button
function ReportBlock({ html }: { html: string }) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeHeight, setIframeHeight] = useState(400);

    // Wrap raw HTML in a print-ready document shell
    const fullDocument = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 32px; max-width: 800px; margin: 0 auto; font-size: 13px; }
  @media print { body { padding: 0; } @page { margin: 20mm; size: A4; } }
</style>
</head><body>${html}</body></html>`;

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const doc = iframe.contentDocument;
        if (!doc) return;

        doc.open();
        doc.write(fullDocument);
        doc.close();

        // Auto-size iframe to content
        const resize = () => {
            const body = doc.body;
            if (body) {
                setIframeHeight(body.scrollHeight + 16);
            }
        };

        // Resize after content loads (including images)
        resize();
        const timer = setTimeout(resize, 300);
        return () => clearTimeout(timer);
    }, [fullDocument]);

    const handleDownload = useCallback(() => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;

        // Open print dialog — user can "Save as PDF" from the browser
        iframe.contentWindow.print();
    }, []);

    return (
        <div className="group/report bg-card my-4 overflow-hidden rounded-xl border shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                    <FileText className="size-3.5" />
                    Report
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2.5 text-xs"
                            onClick={handleDownload}
                        >
                            <Download className="size-3.5" />
                            Download PDF
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Print or save as PDF</TooltipContent>
                </Tooltip>
            </div>

            {/* Report preview */}
            <div className="border-t bg-white">
                <iframe
                    ref={iframeRef}
                    className="w-full border-0"
                    style={{ height: iframeHeight }}
                    sandbox="allow-same-origin allow-modals"
                    title="Report preview"
                />
            </div>
        </div>
    );
}

/**
 * Gemini-style smooth text reveal.
 * Shows raw text during streaming with word-by-word deblur animation.
 * ReactMarkdown only renders once streaming is complete.
 */
function SmoothStreamingText({ content }: { content: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const revealedCountRef = useRef(0);
    const rafRef = useRef<number>(0);
    const words = content.split(/(\s+)/);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const spans = container.querySelectorAll<HTMLSpanElement>('span[data-word]');
        let current = revealedCountRef.current;

        const reveal = () => {
            const batch = Math.max(2, Math.ceil((spans.length - current) * 0.15));
            const end = Math.min(current + batch, spans.length);

            for (let i = current; i < end; i++) {
                spans[i].classList.add('gemini-word-visible');
            }

            current = end;
            revealedCountRef.current = current;

            if (current < spans.length) {
                rafRef.current = requestAnimationFrame(reveal);
            }
        };

        rafRef.current = requestAnimationFrame(reveal);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [words.length]);

    return (
        <>
            <div ref={containerRef} className="gemini-smooth-stream whitespace-pre-wrap text-sm leading-relaxed">
                {words.map((word, i) => (
                    <span
                        key={i}
                        data-word
                        className={i < revealedCountRef.current ? 'gemini-word-visible' : ''}
                    >
                        {word}
                    </span>
                ))}
            </div>
            <style>{`
                .gemini-smooth-stream span[data-word] {
                    opacity: 0;
                    filter: blur(6px);
                    transition: opacity 0.3s ease-out, filter 0.3s ease-out;
                    display: inline;
                }
                .gemini-smooth-stream span.gemini-word-visible {
                    opacity: 1;
                    filter: blur(0);
                }
            `}</style>
        </>
    );
}

function StreamingIndicator() {
    return (
        <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-[10px]">
                <div className="gemini-line h-[14px] w-[85%] rounded-full" style={{ animationDelay: '0s' }} />
                <div className="gemini-line h-[14px] w-[70%] rounded-full" style={{ animationDelay: '0.15s' }} />
                <div className="gemini-line h-[14px] w-[50%] rounded-full" style={{ animationDelay: '0.3s' }} />
            </div>
            <style>{`
                @keyframes gemini-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .gemini-line {
                    background: linear-gradient(90deg,
                        rgba(66,133,244,0.08) 0%, rgba(155,114,203,0.2) 20%,
                        rgba(217,101,112,0.25) 40%, rgba(155,114,203,0.2) 60%,
                        rgba(66,133,244,0.08) 80%, transparent 100%);
                    background-size: 200% 100%;
                    animation: gemini-shimmer 2s ease-in-out infinite;
                }
                :is(.dark) .gemini-line {
                    background: linear-gradient(90deg,
                        rgba(66,133,244,0.12) 0%, rgba(155,114,203,0.3) 20%,
                        rgba(217,101,112,0.35) 40%, rgba(155,114,203,0.3) 60%,
                        rgba(66,133,244,0.12) 80%, transparent 100%);
                    background-size: 200% 100%;
                    animation: gemini-shimmer 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

export const ChatMessage = memo(function ChatMessage({ message, isLatest = false, onRegenerate, showTimestamp = false }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const isStreaming = message.status === 'streaming';
    const isError = message.status === 'error';

    const handleCopy = async () => {
        try {
            // Strip markdown formatting for plain text copy
            const plain = message.content
                .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/, '').replace(/```$/, '').trim())
                .replace(/`([^`]+)`/g, '$1')
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/^#{1,6}\s+/gm, '')
                .replace(/^\s*[-*+]\s+/gm, '- ')
                .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + ' ')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^>\s+/gm, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            await navigator.clipboard.writeText(plain);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API failed
        }
    };

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    };

    return (
        <div className={cn('group relative flex gap-3 px-4 py-4 transition-colors', isUser ? 'bg-transparent' : 'bg-muted/30')}>
            {/* Avatar */}
            <div className="flex-shrink-0">
                <Avatar className={cn('size-8', isUser ? 'bg-primary' : 'border-border bg-background border')}>
                    <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground')}>
                        {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
                    </AvatarFallback>
                </Avatar>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{isUser ? 'You' : 'Superior AI'}</span>
                    {showTimestamp && <span className="text-muted-foreground text-xs">{formatTime(message.timestamp)}</span>}
                </div>

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {message.attachments.map((attachment, index) =>
                            attachment.type.startsWith('image/') && attachment.url ? (
                                <img
                                    key={index}
                                    src={attachment.url}
                                    alt={attachment.name}
                                    className="border-border h-auto max-h-40 max-w-[200px] rounded-lg border object-cover"
                                />
                            ) : (
                                <div key={index} className="bg-muted flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
                                    <FileText className="text-muted-foreground size-3.5" />
                                    <span className="max-w-[150px] truncate">{attachment.name}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {attachment.size < 1024
                                            ? `${attachment.size}B`
                                            : attachment.size < 1048576
                                              ? `${(attachment.size / 1024).toFixed(0)}KB`
                                              : `${(attachment.size / 1048576).toFixed(1)}MB`}
                                    </span>
                                </div>
                            ),
                        )}
                    </div>
                )}

                {/* Message Content */}
                <div className={cn('prose prose-sm dark:prose-invert max-w-none', isError && 'text-destructive')}>
                    {isStreaming && !message.content ? (
                        <StreamingIndicator />
                    ) : isStreaming ? (
                        (() => {
                            // If streaming content contains a report code block, show a loading state
                            // Detect which type of HTML block is streaming
                            const reportMatch = message.content.match(/```(?:report|html-report)\n?/);
                            const chartHtmlMatch = message.content.match(/```(?:htmlchart|html-chart)\n?/);
                            const looksLikeRawHtml = !reportMatch && !chartHtmlMatch && /^<div\s+style=/.test(message.content.trim());

                            // HTML chart streaming — compact chart skeleton
                            if (chartHtmlMatch) {
                                const before = message.content.slice(0, chartHtmlMatch.index).trim();
                                return (
                                    <>
                                        {before && <SmoothStreamingText content={before} />}
                                        <div className="bg-card relative my-4 overflow-hidden rounded-xl border shadow-sm">
                                            {/* Double shimmer — fast sweep + slow glow */}
                                            <div className="pointer-events-none absolute inset-0 z-10" style={{
                                                background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.04) 70%, transparent 100%)',
                                                backgroundSize: '250% 100%',
                                                animation: 'chart-shimmer 1.4s ease-in-out infinite',
                                            }} />
                                            <div className="pointer-events-none absolute inset-0 z-10" style={{
                                                background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 70%)',
                                                animation: 'chart-glow 2.5s ease-in-out infinite',
                                            }} />

                                            <div className="p-5">
                                                {/* Title skeleton */}
                                                <div className="bg-muted h-5 w-44 rounded-md" style={{ animation: 'chart-bar-pulse 1.6s ease-in-out infinite' }} />
                                                <div className="bg-muted/30 mt-2 h-3 w-64 rounded" style={{ animation: 'chart-bar-pulse 1.6s ease-in-out infinite 200ms' }} />

                                                {/* Y-axis + chart area */}
                                                <div className="mt-5 flex gap-2">
                                                    {/* Y-axis labels */}
                                                    <div className="flex flex-col justify-between py-1" style={{ height: 180 }}>
                                                        {[0, 1, 2, 3, 4].map((i) => (
                                                            <div key={i} className="bg-muted/50 h-2 w-7 rounded" style={{ animation: `chart-bar-pulse 1.6s ease-in-out infinite ${300 + i * 80}ms` }} />
                                                        ))}
                                                    </div>

                                                    {/* Chart bars / line area */}
                                                    <div className="relative flex-1">
                                                        {/* Grid lines */}
                                                        {[0, 1, 2, 3, 4].map((i) => (
                                                            <div key={i} className="absolute left-0 right-0 border-t" style={{
                                                                top: `${i * 25}%`,
                                                                borderColor: 'hsl(var(--muted) / 0.3)',
                                                            }} />
                                                        ))}

                                                        {/* Animated bars that grow upward */}
                                                        <div className="relative flex items-end gap-1" style={{ height: 180 }}>
                                                            {[40, 60, 30, 75, 45, 65, 35, 80, 50, 70, 25, 55, 68, 42].map((h, i) => (
                                                                <div key={i} className="relative flex-1 overflow-hidden rounded-t" style={{
                                                                    backgroundColor: 'hsl(var(--muted))',
                                                                    animation: `chart-bar-grow 1.8s ease-out infinite, chart-bar-pulse 2s ease-in-out infinite ${i * 60}ms`,
                                                                    animationDelay: `${i * 70}ms`,
                                                                    height: `${h}%`,
                                                                }}>
                                                                    {/* Inner glow sweep per bar */}
                                                                    <div className="absolute inset-0" style={{
                                                                        background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
                                                                        animation: `chart-bar-inner-sweep 2s ease-in-out infinite ${i * 100}ms`,
                                                                    }} />
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Animated line overlay — simulates a trend line being drawn */}
                                                        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: 180, width: '100%' }}>
                                                            <polyline
                                                                fill="none"
                                                                stroke="hsl(var(--muted-foreground))"
                                                                strokeWidth="0.8"
                                                                strokeLinecap="round"
                                                                strokeDasharray="200"
                                                                strokeDashoffset="200"
                                                                points="3,60 10,40 18,70 25,25 32,55 40,35 48,65 55,20 62,50 70,30 78,75 85,45 92,32 97,58"
                                                                style={{ animation: 'chart-line-draw 2.5s ease-out forwards, chart-line-pulse 3s ease-in-out 2.5s infinite' }}
                                                            />
                                                            {/* Data point dots that appear after line draws */}
                                                            {[
                                                                [3,60],[10,40],[18,70],[25,25],[32,55],[40,35],[48,65],[55,20],[62,50],[70,30],[78,75],[85,45],[92,32],[97,58]
                                                            ].map(([cx, cy], i) => (
                                                                <circle key={i} cx={cx} cy={cy} r="1.2" fill="hsl(var(--muted-foreground))" opacity="0"
                                                                    style={{ animation: `chart-dot-appear 0.3s ease-out ${1.8 + i * 0.08}s forwards` }}
                                                                />
                                                            ))}
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* X-axis labels */}
                                                <div className="ml-9 mt-2 flex justify-between">
                                                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                                                        <div key={i} className="bg-muted/40 h-2 rounded" style={{
                                                            width: `${8 + Math.random() * 4}%`,
                                                            animation: `chart-bar-pulse 1.6s ease-in-out infinite ${800 + i * 70}ms`,
                                                        }} />
                                                    ))}
                                                </div>

                                                {/* Legend skeleton */}
                                                <div className="mt-4 flex items-center justify-center gap-4">
                                                    {[0, 1, 2].map((i) => (
                                                        <div key={i} className="flex items-center gap-1.5" style={{ animation: `chart-bar-pulse 1.6s ease-in-out infinite ${1200 + i * 120}ms` }}>
                                                            <div className="bg-muted size-2.5 rounded-full" />
                                                            <div className="bg-muted/60 h-2 w-14 rounded" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Status bar */}
                                            <div className="border-t px-4 py-2.5">
                                                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                                    <div className="relative flex size-4 items-center justify-center">
                                                        <div className="bg-primary/30 absolute size-4 rounded-full" style={{ animation: 'chart-ping 1.2s ease-out infinite' }} />
                                                        <div className="bg-primary/15 absolute size-6 rounded-full" style={{ animation: 'chart-ping 1.2s ease-out infinite 0.3s' }} />
                                                        <div className="bg-primary relative size-2 rounded-full" />
                                                    </div>
                                                    Drawing chart...
                                                </div>
                                            </div>

                                            <style>{`
                                                @keyframes chart-shimmer {
                                                    0% { background-position: 250% 0; }
                                                    100% { background-position: -250% 0; }
                                                }
                                                @keyframes chart-glow {
                                                    0%, 100% { opacity: 0; }
                                                    50% { opacity: 1; }
                                                }
                                                @keyframes chart-bar-grow {
                                                    0% { transform: scaleY(0.3); transform-origin: bottom; }
                                                    50% { transform: scaleY(1); transform-origin: bottom; }
                                                    100% { transform: scaleY(0.3); transform-origin: bottom; }
                                                }
                                                @keyframes chart-bar-pulse {
                                                    0%, 100% { opacity: 0.4; }
                                                    50% { opacity: 0.8; }
                                                }
                                                @keyframes chart-bar-inner-sweep {
                                                    0%, 100% { transform: translateY(100%); }
                                                    50% { transform: translateY(-100%); }
                                                }
                                                @keyframes chart-line-draw {
                                                    to { stroke-dashoffset: 0; }
                                                }
                                                @keyframes chart-line-pulse {
                                                    0%, 100% { opacity: 0.3; }
                                                    50% { opacity: 0.7; }
                                                }
                                                @keyframes chart-dot-appear {
                                                    to { opacity: 0.5; }
                                                }
                                                @keyframes chart-ping {
                                                    0% { transform: scale(1); opacity: 0.5; }
                                                    100% { transform: scale(2); opacity: 0; }
                                                }
                                            `}</style>
                                        </div>
                                    </>
                                );
                            }

                            // Report streaming — full report skeleton
                            if (reportMatch || looksLikeRawHtml) {
                                const before = message.content.slice(0, reportMatch?.index ?? 0).trim();
                                return (
                                    <>
                                        {before && <SmoothStreamingText content={before} />}
                                        <div className="bg-card relative my-4 overflow-hidden rounded-xl border shadow-sm">
                                            <div className="pointer-events-none absolute inset-0 z-10" style={{
                                                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 60%, transparent 100%)',
                                                backgroundSize: '200% 100%',
                                                animation: 'report-shimmer 2s ease-in-out infinite',
                                            }} />
                                            {/* Header */}
                                            <div className="px-5 pt-5 pb-3">
                                                <div className="bg-muted h-6 w-56 animate-pulse rounded-md" />
                                                <div className="bg-muted/50 mt-2.5 h-3 w-72 animate-pulse rounded" style={{ animationDelay: '200ms' }} />
                                                <div className="bg-muted/30 mt-4 h-px w-full" />
                                            </div>
                                            {/* Summary cards */}
                                            <div className="grid grid-cols-4 gap-3 px-5 pb-4">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <div key={i} className="bg-muted/30 animate-pulse rounded-lg border p-3.5" style={{ animationDelay: `${150 + i * 120}ms` }}>
                                                        <div className="bg-muted/80 h-2 w-14 rounded" />
                                                        <div className="bg-muted mt-2.5 h-5 w-20 rounded" />
                                                        <div className="mt-2 flex items-center gap-1.5">
                                                            <div className="bg-muted/60 h-1.5 w-full rounded-full">
                                                                <div className="bg-muted h-1.5 rounded-full" style={{ width: `${30 + i * 15}%` }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Chart area */}
                                            <div className="px-5 pb-4">
                                                <div className="bg-muted/20 rounded-lg border p-4">
                                                    <div className="bg-muted/60 mb-3 h-3 w-32 animate-pulse rounded" style={{ animationDelay: '600ms' }} />
                                                    <div className="flex items-end gap-2" style={{ height: 80 }}>
                                                        {[65, 40, 85, 55, 30, 70, 45, 90, 35, 60].map((h, i) => (
                                                            <div key={i} className="flex-1 animate-pulse rounded-t" style={{
                                                                height: `${h}%`,
                                                                backgroundColor: i % 2 === 0 ? 'hsl(var(--muted))' : 'hsl(var(--muted)/0.5)',
                                                                animationDelay: `${700 + i * 60}ms`,
                                                            }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Table */}
                                            <div className="px-5 pb-4">
                                                <div className="overflow-hidden rounded-lg border">
                                                    <div className="bg-muted/40 flex gap-4 px-3 py-2.5">
                                                        {[28, 16, 16, 18, 14].map((w, i) => (
                                                            <div key={i} className="bg-muted h-3 animate-pulse rounded" style={{ width: `${w}%`, animationDelay: `${900 + i * 80}ms` }} />
                                                        ))}
                                                    </div>
                                                    {[0, 1, 2, 3, 4, 5].map((row) => (
                                                        <div key={row} className="border-muted/30 flex gap-4 border-t px-3 py-2.5">
                                                            {[28, 16, 16, 18, 14].map((w, col) => (
                                                                <div key={col} className="animate-pulse rounded" style={{
                                                                    width: `${w}%`,
                                                                    height: 10,
                                                                    backgroundColor: `hsl(var(--muted) / ${0.7 - row * 0.05})`,
                                                                    animationDelay: `${1000 + row * 100 + col * 60}ms`,
                                                                }} />
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Footer */}
                                            <div className="px-5 pb-4">
                                                <div className="bg-muted/50 h-2.5 w-48 animate-pulse rounded" style={{ animationDelay: '1600ms' }} />
                                                <div className="bg-muted/30 mt-1.5 h-2.5 w-36 animate-pulse rounded" style={{ animationDelay: '1700ms' }} />
                                            </div>
                                            {/* Status */}
                                            <div className="border-t px-5 py-3">
                                                <div className="text-muted-foreground flex items-center gap-2.5 text-xs">
                                                    <div className="relative flex size-4 items-center justify-center">
                                                        <div className="bg-primary/20 absolute size-4 animate-ping rounded-full" />
                                                        <div className="bg-primary relative size-2 rounded-full" />
                                                    </div>
                                                    Generating report...
                                                </div>
                                            </div>
                                            <style>{`@keyframes report-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                                        </div>
                                    </>
                                );
                            }
                            return <SmoothStreamingText content={message.content} />;
                        })()
                    ) : /^<div\s+style=/.test(message.content.trim()) && !message.content.includes('```') ? (
                        // Fallback: AI output raw HTML without a ```report fence — render it as a report
                        <ReportBlock html={message.content.trim()} />
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Code blocks with syntax highlighting and chart support
                                code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const language = match ? match[1] : '';
                                    const codeString = String(children).replace(/\n$/, '');
                                    // Check if inline based on whether we have a language class (block code has language)
                                    const isInline = !className;

                                    if (isInline) {
                                        return (
                                            <code
                                                className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }

                                    // Check if this is an AI-generated report (HTML document)
                                    if (language === 'report' || language === 'html-report') {
                                        return <ReportBlock html={codeString} />;
                                    }

                                    // Inline HTML visual — just the chart/visual, no wrapper
                                    if (language === 'htmlchart' || language === 'html-chart') {
                                        return <HtmlChartBlock html={codeString} />;
                                    }

                                    // Check if this is chart data (language is 'chart' or 'json' containing chart data)
                                    if (language === 'chart' || language === 'json') {
                                        const chartData = tryParseChartData(codeString);
                                        if (chartData) {
                                            return <ChartBlock data={chartData} />;
                                        }

                                        // Check if this is generated image data
                                        const imageData = tryParseImageData(codeString);
                                        if (imageData) {
                                            return <GeneratedImageBlock data={imageData} />;
                                        }
                                    }

                                    return <CodeBlock language={language}>{codeString}</CodeBlock>;
                                },
                                // Pre tag - let CodeBlock handle the styling
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                                // Tables
                                table({ children }) {
                                    return (
                                        <div className="my-4 overflow-x-auto rounded-lg border">
                                            <table className="w-full text-sm">{children}</table>
                                        </div>
                                    );
                                },
                                thead({ children }) {
                                    return <thead className="bg-muted/50">{children}</thead>;
                                },
                                th({ children }) {
                                    return <th className="border-b px-4 py-2 text-left font-semibold">{children}</th>;
                                },
                                td({ children }) {
                                    return <td className="border-b px-4 py-2">{children}</td>;
                                },
                                // Links
                                a({ href, children }) {
                                    return (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                            {children}
                                        </a>
                                    );
                                },
                                // Lists
                                ul({ children }) {
                                    return <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>;
                                },
                                ol({ children }) {
                                    return <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>;
                                },
                                // Paragraphs
                                p({ children }) {
                                    return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                // Blockquotes
                                blockquote({ children }) {
                                    return <blockquote className="border-primary/50 my-2 border-l-4 pl-4 italic">{children}</blockquote>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}
                </div>

                {/* Action buttons - shown on hover for assistant messages */}
                {!isUser && message.status === 'complete' && (
                    <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground h-7 px-2"
                                    onClick={handleCopy}
                                >
                                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
                        </Tooltip>

                        {isLatest && onRegenerate && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground h-7 px-2"
                                        onClick={onRegenerate}
                                    >
                                        <RefreshCw className="size-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Regenerate</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default ChatMessage;
