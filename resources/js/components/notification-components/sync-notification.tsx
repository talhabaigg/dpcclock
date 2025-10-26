import { RefreshCcw, TriangleAlert, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { type NotificationProps } from './Notification';

const SyncNotification = ({ notification }: { notification: NotificationProps }) => {
    return (
        <Card key={notification.id} className="mx-auto my-1 max-w-[310px] border-b py-0 last:border-2 sm:mx-2 sm:max-w-full">
            <CardContent className="text-sm">
                <div className="flex items-center">
                    {notification.data.status === 'success' ? (
                        <RefreshCcw className="mr-2 inline-block h-6 w-6" />
                    ) : (
                        <TriangleAlert className="mr-2 inline-block h-6 w-6 text-red-500" />
                    )}

                    {notification.data.message}
                    <Button className="ml-auto" variant="ghost">
                        <X />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default SyncNotification;
