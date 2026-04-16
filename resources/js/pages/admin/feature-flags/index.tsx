import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ToggleLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
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

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.error, flash.success]);

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

            <div className="m-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Feature Flags</h1>
                        <p className="text-muted-foreground">Manage application features without deploying code or editing environment variables.</p>
                    </div>
                    <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                        <ToggleLeft className="h-3.5 w-3.5" />
                        {flags.length} flag{flags.length === 1 ? '' : 's'}
                    </Badge>
                </div>

                <div className="grid gap-4">
                    {flags.map((flag) => (
                        <Card key={flag.name} className="p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-lg font-semibold">{flag.label}</h2>
                                        <Badge variant={flag.active ? 'default' : 'secondary'}>{flag.active ? 'Enabled' : 'Disabled'}</Badge>
                                        <Badge variant="outline">Default: {flag.default ? 'On' : 'Off'}</Badge>
                                    </div>
                                    <p className="text-muted-foreground max-w-2xl text-sm">{flag.description}</p>
                                    <code className="text-muted-foreground text-xs">{flag.name}</code>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Label htmlFor={flag.name} className="text-sm font-medium">
                                        {flag.active ? 'On' : 'Off'}
                                    </Label>
                                    <Switch
                                        id={flag.name}
                                        checked={flag.active}
                                        disabled={pending[flag.name] === true}
                                        onCheckedChange={(checked) => toggleFlag(flag, checked)}
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
