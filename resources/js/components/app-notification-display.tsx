import { Bell, X } from 'lucide-react';
import { NotificationProps } from './notification-components/Notification';
import SyncNotification from './notification-components/sync-notification';
import { Button } from './ui/button';

const AppNotificationDisplay = ({ notifications }: { notifications: NotificationProps[] }) => {
    return (
        <ul>
            {notifications.map((notification: NotificationProps) => {
                const { type, message } = notification.data;

                // Decide which component to render based on type
                let NotificationContent;
                switch (type) {
                    case 'LocationSync':
                        NotificationContent = <SyncNotification key={notification.id} notification={notification} />;
                        break;

                    default:
                        NotificationContent = (
                            <div className="flex items-center">
                                <Bell className="mr-2 h-6 w-6 text-gray-500" />
                                <span>{message}</span>
                                <Button className="ml-auto" variant="ghost" size="icon">
                                    <X />
                                </Button>
                            </div>
                        );
                }

                return <>{NotificationContent}</>;
            })}
        </ul>
    );
};
export default AppNotificationDisplay;
