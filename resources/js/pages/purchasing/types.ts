export interface CostCode {
    id: number;
    code: string;
    description: string;
    pivot?: {
        waste_ratio: number;
        variation_ratio: number;
        prelim_type: string;
    };
    cost_type?: {
        id: number;
        code: string;
        description: string;
    };
}
