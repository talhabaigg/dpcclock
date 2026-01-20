import { AiChat } from '@/components/ai-chat';
import AppLayout from '@/layouts/app-layout';
import TokenProgressBar from './token-progress-bar';

const Dashboard = ({ tokenUsage }) => {
    return (
        <AppLayout>
            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Main chat area - takes full height */}
                <div className="min-h-0 flex-1">
                    <AiChat className="h-full" centered />
                </div>
                {/* Token progress bar - fixed at bottom */}
                <div className="shrink-0 border-t bg-background/80 px-4 py-3 backdrop-blur-sm">
                    <div className="mx-auto max-w-96">
                        <TokenProgressBar tokenUsage={tokenUsage} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};
export default Dashboard;
