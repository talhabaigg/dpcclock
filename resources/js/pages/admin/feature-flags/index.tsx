import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, ToggleLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Admin', href: '/admin/roles' },
    { title: 'Feature Flags', href: '/admin/feature-flags' },
];

type FeatureFlag = {
    name: string;
    label: string;
    description: string;
    default: boolean;
    active: boolean;
};

type PageProps = {
    flags: FeatureFlag[];
    flash: {
        success?: string;
        error?: string;
    };
};

export default function FeatureFlagsIndex() {
    const { flags, flash } = usePage<PageProps>().props;
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.error, flash.success]);

    const filtered = useMemo(() => {
        if (!search.trim()) return flags;
        const q = search.toLowerCase();
        return flags.filter(
            (f) =>
                f.label.toLowerCase().includes(q) ||
                f.name.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q),
        );
    }, [flags, search]);

    const toggleFlag = (flag: FeatureFlag, active: boolean) => {
        setPending((current) => ({ ...current, [flag.name]: true }));

        router.put(
            route('admin.feature-flags.update', flag.name),
            { active },
            {
                preserveScroll: true,
                onFinish: () => {
                    setPending((current) => ({ ...current, [flag.name]: false }));
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Feature Flags" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                {flags.length === 0 ? (
                    <Card className="py-2 gap-2">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
                                <ToggleLeft className="text-muted-foreground h-7 w-7" />
                            </div>
                            <h3 className="text-base font-medium">No feature flags configured</h3>
                            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                                Feature flags are defined in code. None are registered yet.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Search + flag count, justified between */}
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <div className="relative max-w-xs flex-1">
                                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                                <Input
                                    placeholder="Search flags..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-9 pl-8 text-sm"
                                />
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                                {flags.length} flag{flags.length === 1 ? '' : 's'}
                            </span>
                        </div>

                        {/* Table */}
                        <Card className="py-2 gap-2">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-4">Flag</TableHead>
                                            <TableHead className="hidden md:table-cell">Default</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-[80px] pr-4 text-right">Toggle</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell colSpan={4} className="py-10 text-center">
                                                    <p className="text-muted-foreground text-sm">
                                                        No flags match "{search}"
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filtered.map((flag) => (
                                                <TableRow key={flag.name} className="hover:bg-muted/30">
                                                    <TableCell className="pl-4">
                                                        <div className="min-w-0">
                                                            <span className="font-medium">{flag.label}</span>
                                                            {flag.description && (
                                                                <p className="text-muted-foreground mt-0.5 max-w-[14rem] truncate text-xs sm:max-w-md">
                                                                    {flag.description}
                                                                </p>
                                                            )}
                                                            <code className="mt-0.5 inline-block text-[11px] text-muted-foreground/70">
                                                                {flag.name}
                                                            </code>
                                                            {/* Mobile-only: surface default since the column is hidden */}
                                                            <span className="mt-1 inline-block text-[11px] text-muted-foreground md:hidden">
                                                                · Default: {flag.default ? 'On' : 'Off'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <span className="text-muted-foreground text-xs">
                                                            {flag.default ? 'On' : 'Off'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-normal shadow-none">
                                                            {flag.active ? 'Enabled' : 'Disabled'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pr-4 text-right">
                                                        <Switch
                                                            id={flag.name}
                                                            checked={flag.active}
                                                            disabled={pending[flag.name] === true}
                                                            onCheckedChange={(checked) => toggleFlag(flag, checked)}
                                                            aria-label={`Toggle ${flag.label}`}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {search.trim() && filtered.length > 0 && (
                            <p className="text-muted-foreground mt-2 text-xs">
                                Showing {filtered.length} of {flags.length} flag{flags.length === 1 ? '' : 's'}
                            </p>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
