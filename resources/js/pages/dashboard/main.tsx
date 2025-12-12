import AppLayout from '@/layouts/app-layout';
import SimpleChatBox from '../purchasing/create-partials/simpleChatBox';
import TokenProgressBar from './token-progress-bar';

const Dashboard = ({ tokenUsage }) => {
    return (
        <AppLayout>
            {' '}
            <div className="mx-auto w-full p-2">
                <SimpleChatBox />{' '}
            </div>
            <div className="mx-auto max-w-96 p-2">
                {' '}
                <TokenProgressBar tokenUsage={tokenUsage} />
            </div>
        </AppLayout>
    );
};
export default Dashboard;
