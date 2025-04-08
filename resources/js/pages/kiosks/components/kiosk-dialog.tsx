// DialogBox.tsx
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface DialogBoxProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children?: React.ReactNode;
}

const KioskDialogBox: React.FC<DialogBoxProps> = ({ isOpen, onClose, title, description, children }) => {
    const handleClose = () => {
        onClose(); // Trigger the onClose function passed as a prop
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <VisuallyHidden>
                <DialogTitle>{title}</DialogTitle>
            </VisuallyHidden>
            <DialogContent className="flex flex-col items-center p-0">
                {description && (
                    <VisuallyHidden>
                        <DialogDescription className="mx-auto text-xl">{description}</DialogDescription>
                    </VisuallyHidden>
                )}
                <p className="mx-auto mt-4 p-2 text-2xl font-bold">{title}</p>
                {children}
                <button onClick={handleClose} className="mx-auto mt-2 w-full border-t-2 py-4 text-2xl font-extrabold">
                    OK
                </button>
            </DialogContent>
        </Dialog>
    );
};

export default KioskDialogBox;
