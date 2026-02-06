'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Check, Copy, Download, Image as ImageIcon, RefreshCw, Sparkles, User } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
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

// Chart colors palette
const CHART_COLORS = [
    '#8b5cf6', // violet
    '#22c55e', // green
    '#3b82f6', // blue
    '#f97316', // orange
    '#ec4899', // pink
    '#eab308', // yellow
    '#06b6d4', // cyan
    '#ef4444', // red
];

// Chart visualization component
interface ChartData {
    type: 'bar' | 'line' | 'pie';
    title?: string;
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

    // Transform data for recharts format
    const chartData = data.labels
        ? data.labels.map((label, index) => {
              const point: Record<string, string | number> = { name: label };
              data.datasets?.forEach((dataset) => {
                  point[dataset.label] = dataset.data[index] || 0;
              });
              return point;
          })
        : data.data || [];

    const formatValue = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    };

    const handleDownload = useCallback(async () => {
        if (!chartRef.current || isDownloading) return;

        setIsDownloading(true);
        try {
            // Find the SVG element inside the chart container
            const svgElement = chartRef.current.querySelector('svg');
            if (!svgElement) {
                console.error('No SVG found in chart');
                return;
            }

            // Clone the SVG to avoid modifying the original
            const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

            // Set explicit dimensions
            const bbox = svgElement.getBoundingClientRect();
            clonedSvg.setAttribute('width', String(bbox.width));
            clonedSvg.setAttribute('height', String(bbox.height));

            // Add white background for better visibility
            const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            background.setAttribute('width', '100%');
            background.setAttribute('height', '100%');
            background.setAttribute('fill', '#ffffff');
            clonedSvg.insertBefore(background, clonedSvg.firstChild);

            // Convert SVG to data URL
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(clonedSvg);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const svgUrl = URL.createObjectURL(svgBlob);

            // Create canvas and draw image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Set canvas size with padding
                const padding = 20;
                canvas.width = bbox.width + padding * 2;
                canvas.height = bbox.height + padding * 2;

                if (ctx) {
                    // Fill white background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Draw the chart image centered
                    ctx.drawImage(img, padding, padding);

                    // Add title if present
                    if (data.title) {
                        ctx.fillStyle = '#1f2937';
                        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(data.title, canvas.width / 2, 16);
                    }

                    // Convert to PNG and download
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `chart-${data.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'export'}-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }
                    }, 'image/png');
                }

                URL.revokeObjectURL(svgUrl);
                setIsDownloading(false);
            };

            img.onerror = () => {
                console.error('Failed to load SVG image');
                URL.revokeObjectURL(svgUrl);
                setIsDownloading(false);
            };

            img.src = svgUrl;
        } catch (error) {
            console.error('Failed to download chart:', error);
            setIsDownloading(false);
        }
    }, [data.title, isDownloading]);

    // Custom tooltip component for better styling
    const CustomTooltip = ({
        active,
        payload,
        label,
    }: {
        active?: boolean;
        payload?: Array<{ name: string; value: number; color: string }>;
        label?: string;
    }) => {
        if (!active || !payload || !payload.length) return null;

        return (
            <div className="border-border bg-popover rounded-lg border px-3 py-2 shadow-lg">
                <p className="text-foreground mb-1 text-xs font-medium">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="text-foreground font-medium">{formatValue(entry.value)}</span>
                    </div>
                ))}
            </div>
        );
    };

    // Truncate long labels for X-axis
    const truncateLabel = (label: string, maxLength: number = 8) => {
        if (label.length <= maxLength) return label;
        return label.slice(0, maxLength) + '...';
    };

    return (
        <div className="group/chart border-border/50 bg-card my-4 overflow-hidden rounded-xl border shadow-sm">
            {/* Header with title and download button */}
            <div className="border-border/50 bg-muted/30 flex items-center justify-between border-b px-4 py-3">
                {data.title ? <h4 className="text-foreground text-sm font-semibold">{data.title}</h4> : <div />}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:bg-muted hover:text-foreground h-7 gap-1.5 px-2 text-xs opacity-0 transition-opacity group-hover/chart:opacity-100"
                            onClick={handleDownload}
                            disabled={isDownloading}
                        >
                            <Download className={cn('size-3.5', isDownloading && 'animate-bounce')} />
                            {isDownloading ? 'Saving...' : 'Save'}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download as PNG</TooltipContent>
                </Tooltip>
            </div>
            <div ref={chartRef} className="h-[320px] w-full p-4">
                <ResponsiveContainer width="100%" height="100%">
                    {data.type === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={false}
                                axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                                angle={-45}
                                textAnchor="end"
                                height={70}
                                interval={0}
                                tickFormatter={(value) => truncateLabel(String(value))}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={formatValue}
                                width={60}
                            />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" iconSize={8} />
                            {data.datasets?.map((dataset, index) => (
                                <Bar
                                    key={dataset.label}
                                    dataKey={dataset.label}
                                    fill={(dataset.backgroundColor as string) || CHART_COLORS[index % CHART_COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                            ))}
                        </BarChart>
                    ) : data.type === 'line' ? (
                        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={false}
                                axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                                angle={-45}
                                textAnchor="end"
                                height={70}
                                interval={0}
                                tickFormatter={(value) => truncateLabel(String(value))}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={formatValue}
                                width={60}
                            />
                            <RechartsTooltip
                                content={<CustomTooltip />}
                                cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '4 4' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" iconSize={8} />
                            {data.datasets?.map((dataset, index) => (
                                <Line
                                    key={dataset.label}
                                    type="monotone"
                                    dataKey={dataset.label}
                                    stroke={(dataset.backgroundColor as string) || CHART_COLORS[index % CHART_COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ fill: CHART_COLORS[index % CHART_COLORS.length], strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 2 }}
                                />
                            ))}
                        </LineChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="45%"
                                innerRadius={55}
                                outerRadius={95}
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent, cx, cy, midAngle, outerRadius }) => {
                                    // Don't show labels for very small slices
                                    if (percent < 0.02) return null;
                                    const RADIAN = Math.PI / 180;
                                    const radius = outerRadius + 25;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    return (
                                        <text
                                            x={x}
                                            y={y}
                                            fill="hsl(var(--foreground))"
                                            textAnchor={x > cx ? 'start' : 'end'}
                                            dominantBaseline="central"
                                            fontSize={11}
                                            fontWeight={500}
                                        >
                                            {`${truncateLabel(name, 8)} ${(percent * 100).toFixed(0)}%`}
                                        </text>
                                    );
                                }}
                                labelLine={{
                                    stroke: 'hsl(var(--muted-foreground))',
                                    strokeWidth: 1,
                                    strokeOpacity: 0.5,
                                }}
                            >
                                {chartData.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                                        stroke="hsl(var(--card))"
                                        strokeWidth={2}
                                    />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" iconSize={8} layout="horizontal" verticalAlign="bottom" />
                        </PieChart>
                    )}
                </ResponsiveContainer>
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
        } catch (error) {
            console.error('Failed to download image:', error);
        } finally {
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

export const ChatMessage = memo(function ChatMessage({ message, isLatest = false, onRegenerate, showTimestamp = false }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const isStreaming = message.status === 'streaming';
    const isError = message.status === 'error';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
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
                <Avatar className={cn('size-8', isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-600')}>
                    <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-white')}>
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

                {/* Message Content */}
                <div className={cn('prose prose-sm dark:prose-invert max-w-none', isError && 'text-destructive')}>
                    {isStreaming && !message.content ? (
                        <StreamingIndicator forceTool={message.metadata?.forceTool} />
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

                    {/* Streaming cursor */}
                    {isStreaming && message.content && <span className="bg-primary ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm" />}
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

function StreamingIndicator({ forceTool }: { forceTool?: string }) {
    const isGeneratingImage = forceTool === 'generate_image';

    if (isGeneratingImage) {
        return (
            <div className="space-y-4">
                {/* Animated generating image text */}
                <div className="flex items-center gap-2">
                    <ImageIcon className="size-4 animate-pulse text-pink-500" />
                    <span className="animate-pulse bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 bg-clip-text text-sm font-medium text-transparent">
                        Generating image...
                    </span>
                </div>

                {/* Image placeholder with animated border */}
                <div className="relative h-64 w-64 overflow-hidden rounded-xl">
                    {/* Animated gradient border */}
                    <div
                        className="absolute inset-0 rounded-xl"
                        style={{
                            background: 'linear-gradient(90deg, #ec4899, #f43f5e, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899)',
                            backgroundSize: '200% 100%',
                            animation: 'rainbow-shift 3s linear infinite',
                            padding: '2px',
                        }}
                    >
                        <div className="bg-card h-full w-full rounded-xl" />
                    </div>

                    {/* Inner content */}
                    <div className="bg-muted/30 absolute inset-[2px] flex flex-col items-center justify-center gap-3 rounded-xl">
                        {/* Spinning loader */}
                        <div className="relative size-12">
                            <div className="absolute inset-0 rounded-full border-2 border-pink-500/20" />
                            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-pink-500" />
                            <ImageIcon className="absolute inset-0 m-auto size-5 text-pink-500/60" />
                        </div>
                        <span className="text-muted-foreground text-xs">Creating your image...</span>
                    </div>
                </div>

                {/* CSS for rainbow border animation */}
                <style>{`
                    @keyframes rainbow-shift {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 200% 50%; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Animated thinking text with sparkle */}
            <div className="flex items-center gap-2">
                <Sparkles className="size-4 animate-pulse text-violet-500" />
                <span className="animate-pulse bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-sm font-medium text-transparent">
                    Thinking...
                </span>
            </div>

            {/* Skeleton shimmer lines */}
            <div className="space-y-2">
                <div className="bg-muted/50 h-4 w-full overflow-hidden rounded">
                    <div className="ai-shimmer h-full w-full" />
                </div>
                <div className="bg-muted/50 h-4 w-4/5 overflow-hidden rounded">
                    <div className="ai-shimmer h-full w-full" />
                </div>
                <div className="bg-muted/50 h-4 w-3/5 overflow-hidden rounded">
                    <div className="ai-shimmer h-full w-full" />
                </div>
            </div>

            {/* CSS for shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                .ai-shimmer {
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(139, 92, 246, 0.15),
                        rgba(168, 85, 247, 0.2),
                        rgba(139, 92, 246, 0.15),
                        transparent
                    );
                    animation: shimmer 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

export default ChatMessage;
