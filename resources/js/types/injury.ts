export interface Injury {
    id: number;
    id_formal: string;
    location_id: number | null;
    employee_id: number | null;
    employee_name: string | null;
    employee_address: string | null;
    incident: string;
    incident_other: string | null;
    occurred_at: string | null;
    reported_by: string | null;
    reported_at: string | null;
    reported_to: string | null;
    location_of_incident: string | null;
    description: string | null;
    emergency_services: boolean;
    work_cover_claim: boolean;
    claim_active: boolean;
    claim_type: string | null;
    claim_status: string | null;
    capacity: string | null;
    employment_status: string | null;
    claim_cost: number;
    days_suitable_duties: number;
    suitable_duties_from: string | null;
    suitable_duties_to: string | null;
    computed_suitable_duties_days: number;
    medical_expenses: number;
    treatment: boolean;
    treatment_at: string | null;
    treatment_provider: string | null;
    treatment_external: string | null;
    treatment_external_location: string | null;
    no_treatment_reason: string | null;
    follow_up: boolean | null;
    follow_up_notes: string | null;
    work_days_missed: number;
    report_type: string | null;
    witnesses: boolean;
    witness_details: string | null;
    natures: string[] | null;
    natures_comments: string | null;
    mechanisms: string[] | null;
    mechanisms_comments: string | null;
    agencies: string[] | null;
    agencies_comments: string | null;
    contributions: string[] | null;
    contributions_comments: string | null;
    corrective_actions: string[] | null;
    corrective_actions_comments: string | null;
    worker_signature: string | null;
    representative_signature: string | null;
    representative_id: number | null;
    body_location_image: string | null;
    locked_at: string | null;
    created_by: number | null;
    updated_by: number | null;
    created_at: string;
    updated_at: string;
    incident_label: string | null;
    report_type_label: string | null;
    employee?: InjuryEmployee;
    location?: InjuryLocation;
    representative?: InjuryEmployee;
    creator?: { id: number; name: string };
    media?: InjuryMedia[];
}

export interface InjuryEmployee {
    id: number;
    name: string;
    preferred_name: string | null;
    employment_type?: string | null;
    display_name?: string;
}

export interface InjuryLocation {
    id: number;
    name: string;
}

export interface InjuryMedia {
    id: number;
    file_name: string;
    mime_type: string;
    size: number;
    original_url: string;
    collection_name: string;
}

export interface InjuryFormOptions {
    incidents: Record<string, string>;
    reportTypes: Record<string, string>;
    treatmentExternal: Record<string, string>;
    natures: Record<string, string>;
    mechanisms: Record<string, string>;
    agencies: Record<string, string>;
    contributions: Record<string, string>;
    correctiveActions: Record<string, string>;
    claimTypes: Record<string, string>;
    claimStatuses: Record<string, string>;
    capacities: Record<string, string>;
    employmentStatuses: Record<string, string>;
}

export interface InjuryFilters {
    search?: string;
    location_id?: string;
    employee_id?: string;
    incident?: string;
    report_type?: string;
    work_cover_claim?: string;
    status?: string;
}
