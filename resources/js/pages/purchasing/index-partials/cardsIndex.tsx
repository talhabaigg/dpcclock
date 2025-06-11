import RequisitionCard from './requisitionCard';
import { Requisition } from './types';

interface CardsIndexProps {
    filteredRequisitions: Requisition[];
}

const CardsIndex = ({ filteredRequisitions }: CardsIndexProps) => {
    return (
        <div className="grid grid-cols-1 space-y-2 space-x-2 sm:grid-cols-2 md:grid-cols-3">
            {filteredRequisitions.map((requisition) => (
                <RequisitionCard key={requisition.id} requisition={requisition} />
            ))}
        </div>
    );
};

export default CardsIndex;
