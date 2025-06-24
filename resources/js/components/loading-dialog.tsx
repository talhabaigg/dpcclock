import { Dialog, DialogContent, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { MoonLoader } from 'react-spinners';
import { Label } from './ui/label';

const LoadingDialog = ({ open, setOpen }) => {
    return (
        <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
            <DialogContent>
                <DialogHeader>
                    <DialogDescription className="mx-auto">
                        <div className="flex flex-col items-center space-y-2">
                            <MoonLoader speedMultiplier={0.5} size={30} />
                            <Label>Loading...</Label>
                        </div>
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
};

export default LoadingDialog;
