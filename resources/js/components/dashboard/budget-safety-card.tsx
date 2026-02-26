import BudgetDonutCard, { type ProductionCostCode } from './budget-donut-card';

export type { ProductionCostCode };

interface BudgetSafetyCardProps {
    locationId: number;
    costCodes: ProductionCostCode[];
    savedCostCode?: string | null;
}

export default function BudgetSafetyCard({ locationId, costCodes, savedCostCode }: BudgetSafetyCardProps) {
    return (
        <BudgetDonutCard
            title="Budget v/s Actual - Safety"
            locationId={locationId}
            costCodes={costCodes}
            savedCostCode={savedCostCode}
            settingKey="safety_cost_code"
        />
    );
}
