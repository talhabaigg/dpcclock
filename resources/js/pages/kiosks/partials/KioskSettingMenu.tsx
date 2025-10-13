import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useForm } from '@inertiajs/react';
import { Delete, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import PinNumpad from '../auth/components/numpad';
import PinInputBox from '../auth/components/pinInputBox';

interface KioskSettingMenuProps {
    kioskId: number;
    adminMode: boolean | undefined;
}
const KioskSettingMenu = ({ kioskId, adminMode }: KioskSettingMenuProps) => {
    console.log('KioskSettingMenu adminMode:', adminMode);
    const form = useForm<{ pin: string; kioskId: number }>({
        pin: '',
        kioskId, // set once; no need to re-set in useEffect
    });
    const [showProcessing, setShowProcessing] = useState(false);
    const handleNumClick = (num: string) => {
        if (form.data.pin.length < 4) {
            form.setData('pin', form.data.pin + num);
        }
    };
    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (form.data.pin.length === 4) {
            setShowProcessing(true);

            // Ensure kioskId is present at submit time (belt & braces)
            form.transform((data) => ({
                ...data,
                kioskId: Number(kioskId),
            }));

            // Post immediately (recommended). If you truly want delay, add ", 2000".
            // setTimeout(() => {
            form.post(route('kiosk.validate-admin-pin'), {
                onFinish: () => {
                    setShowProcessing(false);
                    form.reset('pin');
                    setOpen(false);
                },
            });
            // }, 2000);
        }
    };
    useEffect(() => {
        if (form.data.pin.length === 4) {
            handleSubmit();
        }
    }, [form.data.pin]);

    const [open, setOpen] = useState(false);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full bg-gray-900 p-2 hover:bg-gray-700">
                <Settings className="text-white" />
            </DropdownMenuTrigger>

            <DropdownMenuContent>
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!adminMode && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger className="ml-2 text-sm">Switch to Admin Mode</DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Enter Admin PIN</DialogTitle>
                                <DialogDescription>4 digit Admin PIN to switch to Admin Mode.</DialogDescription>
                                <div className="flex flex-col items-center justify-center">
                                    {showProcessing ? (
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="mb-4 text-lg font-medium">Processing...</div>
                                            <div className="loader" />
                                        </div>
                                    ) : (
                                        <>
                                            {' '}
                                            <div className="mb-2 flex items-center space-x-2">
                                                <PinInputBox pin={form.data.pin} />
                                                <Button className="h-16 w-16 rounded-full" variant="ghost" size="icon">
                                                    <Delete />
                                                </Button>
                                            </div>
                                            <PinNumpad
                                                onClick={(key) => {
                                                    if (key === 'C') {
                                                        form.setData('pin', '');
                                                    } else {
                                                        handleNumClick(key);
                                                    }
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                            </DialogHeader>
                        </DialogContent>
                    </Dialog>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
export default KioskSettingMenu;
