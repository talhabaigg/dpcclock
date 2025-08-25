export interface CostCode {
    id: number;
    code: string;
    description: string;
    cost_type?: {
        id: number;
        code: string;
        description: string;
    };
}
