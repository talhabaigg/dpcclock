import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link } from '@inertiajs/react';
import { CirclePlus } from 'lucide-react';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Variations',
        href: '/variations',
    },
];

const VariationIndex = () => {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Link href="/variations/create" className="flex items-center gap-2">
                            <CirclePlus size={12} />
                            Create New
                        </Link>
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default VariationIndex;
