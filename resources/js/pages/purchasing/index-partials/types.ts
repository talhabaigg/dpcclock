export interface Requisition {
    line_items_sum_total_cost: any;
    id: number;
    supplier: { name: string, code: string };
    location: { name: string } | null;
    status: string;
    po_number: string | null;
    is_template: boolean;
    order_reference: string | null;
    date_required: string;
    delivery_contact: string | null;
    deliver_to: string | null;
    creator: { name: string } | null;
    created_at: string;
    notes?: { id: number; note: string; created_at: string; user: { name: string } }[];
};