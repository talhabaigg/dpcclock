import { AiChat } from '@/components/ai-chat';
import AppLayout from '@/layouts/app-layout';

const Dashboard = () => {
    return (
        <AppLayout>
            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Main chat area - takes full height */}
                <div className="min-h-0 flex-1">
                    <AiChat className="h-full" centered />
                </div>
            </div>
        </AppLayout>
    );
};
export default Dashboard;
