import { Badge } from '@/components/ui/badge';
import { Hourglass, Loader, Send, Truck } from 'lucide-react';
import RequisitionCard from './requisitionCard';
import { Requisition } from './types';

interface CardsIndexProps {
    filteredRequisitions: Requisition[];
}

const CardsIndex = ({ filteredRequisitions }: CardsIndexProps) => {
    return (
        <div className="grid grid-cols-1 space-y-2 space-x-2 sm:grid-cols-2 md:grid-cols-4">
            <div className="border-r border-l p-1">
                <Badge className="mb-2">
                    <Loader /> Pending
                </Badge>
                <div className="space-y-1">
                    {filteredRequisitions
                        .filter((requisition) => requisition.status === 'pending')
                        .map((requisition) => (
                            <RequisitionCard key={requisition.id} requisition={requisition} />
                        ))}
                </div>
            </div>
            <div className="border-r border-l p-1">
                <Badge className="mb-2">
                    <Send />
                    Sent to Premier
                </Badge>
                <div className="space-y-1">
                    {filteredRequisitions
                        .filter((requisition) => requisition.status === 'sent to premier')
                        .map((requisition) => (
                            <RequisitionCard key={requisition.id} requisition={requisition} />
                        ))}
                </div>
            </div>
            <div className="border-r border-l p-1">
                <Badge className="mb-2">
                    <Hourglass />
                    Waiting in Premier
                </Badge>
                <div className="space-y-1">
                    {filteredRequisitions
                        .filter((requisition) => requisition.status === 'success')
                        .map((requisition) => (
                            <RequisitionCard key={requisition.id} requisition={requisition} />
                        ))}
                </div>
            </div>
            <div className="border-r border-l p-1">
                <Badge className="mb-2">
                    <Truck />
                    Sent to Supplier
                </Badge>
                <div className="space-y-1">
                    {filteredRequisitions
                        .filter((requisition) => requisition.status === 'sent')
                        .map((requisition) => (
                            <RequisitionCard key={requisition.id} requisition={requisition} />
                        ))}
                </div>
            </div>
        </div>
    );
};

export default CardsIndex;
