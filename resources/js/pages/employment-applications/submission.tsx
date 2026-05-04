import SubmissionContent, { type SubmissionApplication } from '@/components/employment-applications/submission-content';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Download } from 'lucide-react';

interface Application extends SubmissionApplication {
    created_at: string;
}

interface PageProps {
    application: Application;
}

function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Submission({ application: app }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employment Enquiries', href: '/employment-applications' },
        { title: `${app.first_name} ${app.surname}`, href: `/employment-applications/${app.id}` },
        { title: 'Full Submission', href: `/employment-applications/${app.id}/submission` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${app.first_name} ${app.surname} — Full Submission`} />

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-3 sm:p-6">
                <div className="flex items-center justify-between">
                    <Link
                        href={`/employment-applications/${app.id}`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to enquiry
                    </Link>
                    <a
                        href={`/employment-applications/${app.id}/submission/pdf`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Download PDF
                    </a>
                </div>

                <SubmissionContent application={app} />

                <p className="text-muted-foreground text-center text-xs">Submitted on {formatDate(app.created_at)}</p>
            </div>
        </AppLayout>
    );
}
