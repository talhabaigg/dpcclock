import BudgetDonutCard, { type ProductionCostCode } from './budget-donut-card';

interface BudgetWeatherCardProps {
    locationId: number;
    costCodes: ProductionCostCode[];
    savedCostCode?: string | null;
}

export default function BudgetWeatherCard({ locationId, costCodes, savedCostCode }: BudgetWeatherCardProps) {
    return (
        <BudgetDonutCard
            title="Budget v/s Actual - Weather"
            locationId={locationId}
            costCodes={costCodes}
            savedCostCode={savedCostCode}
            settingKey="weather_cost_code"
        />
    );
}
