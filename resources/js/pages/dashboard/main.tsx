import { AiChat } from '@/components/ai-chat';
import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';

interface PageProps {
    auth: {
        permissions: string[];
    };
    [key: string]: unknown;
}

const Dashboard = () => {
    const { auth } = usePage<PageProps>().props;
    const permissions = auth?.permissions ?? [];
    const hasAiChat = permissions.includes('ai.chat');
    const hasAiVoice = permissions.includes('ai.voice');

    return (
        <AppLayout>
            <Head title="Dashboard" />
            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {hasAiChat ? (
                    <div className="min-h-0 flex-1">
                        <AiChat className="h-full" centered enableVoice={hasAiVoice} />
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-muted-foreground text-center">
                            <p className="text-lg font-medium">Welcome to the Dashboard</p>
                            <p className="mt-2 text-sm">Contact an administrator if you need access to AI features.</p>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};
export default Dashboard;
