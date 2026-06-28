import { Head, usePage } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

interface TokenStats {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    message_count: number;
    estimated_cost: number;
    limit: number;
    voice_minutes: number;
    voice_calls: number;
    voice_cost: number;
    total_cost: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'AI Usage',
        href: '/settings/ai-usage',
    },
];

function formatNumber(num: number): string {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
}

export default function AiUsage() {
    const { tokenStats } = usePage<{ tokenStats: TokenStats }>().props;

    const percent = tokenStats.limit > 0 ? Math.min((tokenStats.total_tokens / tokenStats.limit) * 100, 100) : 0;
    const remaining = Math.max(tokenStats.limit - tokenStats.total_tokens, 0);
    const progressColor = percent >= 90 ? 'bg-destructive' : percent >= 70 ? 'bg-foreground/60' : 'bg-foreground/80';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="AI Usage" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="AI Usage" description="Track your token consumption and estimated AI costs" />

                    <Card>
                        <CardHeader>
                            <CardTitle>Token usage</CardTitle>
                            <CardDescription>
                                {formatNumber(tokenStats.total_tokens)} of {formatNumber(tokenStats.limit)} tokens used
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="bg-muted relative h-2 w-full overflow-hidden rounded-full">
                                <div
                                    className={cn('h-full transition-all duration-500', progressColor)}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <div className="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
                                <span>{percent.toFixed(1)}% used</span>
                                <span>{formatNumber(remaining)} left</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Breakdown</CardTitle>
                            <CardDescription>Input and output token totals</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/50 rounded-md p-3">
                                    <dt className="text-muted-foreground text-xs">Input</dt>
                                    <dd className="mt-1 text-lg font-medium tabular-nums">{formatNumber(tokenStats.input_tokens)}</dd>
                                </div>
                                <div className="bg-muted/50 rounded-md p-3">
                                    <dt className="text-muted-foreground text-xs">Output</dt>
                                    <dd className="mt-1 text-lg font-medium tabular-nums">{formatNumber(tokenStats.output_tokens)}</dd>
                                </div>
                                <div className="bg-muted/50 rounded-md p-3">
                                    <dt className="text-muted-foreground text-xs">Messages</dt>
                                    <dd className="mt-1 text-lg font-medium tabular-nums">{tokenStats.message_count.toLocaleString()}</dd>
                                </div>
                                {(tokenStats.voice_calls > 0 || tokenStats.voice_minutes > 0) && (
                                    <div className="bg-muted/50 rounded-md p-3">
                                        <dt className="text-muted-foreground text-xs">Voice</dt>
                                        <dd className="mt-1 text-lg font-medium tabular-nums">
                                            {tokenStats.voice_calls} calls · {tokenStats.voice_minutes.toFixed(1)}m
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Estimated cost</CardTitle>
                            <CardDescription>Approximate spend based on current usage</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Chat cost</span>
                                <span className="font-medium tabular-nums">${tokenStats.estimated_cost.toFixed(4)}</span>
                            </div>
                            {tokenStats.voice_cost > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Voice cost</span>
                                    <span className="font-medium tabular-nums">${tokenStats.voice_cost.toFixed(4)}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-between border-t pt-2 text-sm">
                                <span className="font-medium">Total cost</span>
                                <span className="font-semibold tabular-nums">${tokenStats.total_cost.toFixed(4)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
