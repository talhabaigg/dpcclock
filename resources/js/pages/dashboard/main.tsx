import AppLayout from '@/layouts/app-layout';
import SimpleChatBox from '../purchasing/create-partials/simpleChatBox';

const Dashboard = () => {
    return (
        <AppLayout>
            {' '}
            <div className="mx-auto w-full p-2">
                <SimpleChatBox />{' '}
            </div>
        </AppLayout>
    );
};
export default Dashboard;
