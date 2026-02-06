export interface Requisition {
    line_items_sum_total_cost: any;
    id: number;
    supplier: { name: string; code: string };
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
}

export interface RequisitionData {
    data: Requisition[];
    current_page: number;
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: { url: string | null; label: string; active: boolean }[];
    next_page_url: string | null;
    prev_page_url: string | null;
}

export interface FilterOptions {
    statuses: string[];
    suppliers: string[];
    locations: string[];
    creators: string[];
    deliver_to: string[];
    contacts: string[];
}

export interface CostRange {
    min: number;
    max: number;
}

export interface Filters {
    search: string;
    status: string;
    supplier: string;
    location: string;
    creator: string;
    deliver_to: string;
    contact: string;
    templates_only: boolean;
    min_cost: string;
    max_cost: string;
}
