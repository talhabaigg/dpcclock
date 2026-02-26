import BudgetDonutCard, { type ProductionCostCode } from './budget-donut-card';

export type { ProductionCostCode };

interface BudgetSafetyCardProps {
    locationId: number;
    costCodes: ProductionCostCode[];
    savedCostCode?: string | null;
    isEditing?: boolean;
}

export default function BudgetSafetyCard({ locationId, costCodes, savedCostCode, isEditing }: BudgetSafetyCardProps) {
    return (
        <BudgetDonutCard
            title="Budget v/s Actual - Safety"
            locationId={locationId}
            costCodes={costCodes}
            savedCostCode={savedCostCode}
            settingKey="safety_cost_code"
            isEditing={isEditing}
        />
    );
}
