import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { router } from '@inertiajs/react';
import { Bot, Send, X } from 'lucide-react';
import { useState } from 'react';

interface AgentConfirmationCardProps {
    taskId: number;
    poNumber: string;
    supplierName: string;
    locationName: string;
    totalCost: string;
}

export default function AgentConfirmationCard({
    taskId,
    poNumber,
    supplierName,
    locationName,
    totalCost,
}: AgentConfirmationCardProps) {
    const [supplierMessage, setSupplierMessage] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    function handleConfirm() {
        setIsConfirming(true);
        router.post(
            `/agent/task/${taskId}/confirm`,
            { supplier_message: supplierMessage },
            {
                preserveScroll: true,
                onFinish: () => setIsConfirming(false),
            },
        );
    }

    function handleCancel() {
        setIsCancelling(true);
        router.post(
            `/agent/task/${taskId}/cancel`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsCancelling(false),
            },
        );
    }

    return (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Bot className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Agent Ready to Send PO to Supplier
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm">
                    <p>
                        <span className="font-medium">{poNumber}</span> for{' '}
                        <span className="font-medium">{supplierName}</span> ({locationName}) —{' '}
                        <span className="font-medium">${totalCost}</span>
                    </p>
                    <p className="mt-1 text-muted-foreground">
                        The agent will log into Premier and send this PO to the supplier. You'll see screenshots of each step as proof.
                    </p>
                </div>

                <div>
                    <label htmlFor="supplier-message" className="text-sm font-medium text-muted-foreground">
                        Message for supplier (optional)
                    </label>
                    <Textarea
                        id="supplier-message"
                        placeholder="e.g. Please deliver to Gate 2 by Friday"
                        value={supplierMessage}
                        onChange={(e) => setSupplierMessage(e.target.value)}
                        className="mt-1"
                        rows={2}
                    />
                </div>

                <div className="flex gap-2">
                    <Button onClick={handleConfirm} disabled={isConfirming || isCancelling} className="gap-1.5">
                        {isConfirming ? (
                            <>Sending...</>
                        ) : (
                            <>
                                <Send className="h-4 w-4" />
                                Confirm & Send
                            </>
                        )}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={isConfirming || isCancelling} className="gap-1.5">
                        {isCancelling ? (
                            <>Cancelling...</>
                        ) : (
                            <>
                                <X className="h-4 w-4" />
                                Cancel
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
