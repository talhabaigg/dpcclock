export type Project = {
    id: number;
    name: string;
};

export type Observation = {
    id: number;
    drawing_id: number;
    page_number: number;
    x: number;
    y: number;
    bbox_width?: number | null;
    bbox_height?: number | null;
    type: 'defect' | 'observation';
    description: string;
    photo_url?: string | null;
    is_360_photo?: boolean;
    created_at?: string;
    created_by_user?: { name: string };
    source?: 'ai_comparison' | null;
    source_sheet_a_id?: number | null;
    source_sheet_b_id?: number | null;
    ai_change_type?: string | null;
    ai_impact?: 'low' | 'medium' | 'high' | null;
    ai_location?: string | null;
    potential_change_order?: boolean;
    is_confirmed?: boolean;
    confirmed_at?: string | null;
    confirmed_by?: number | null;
};

export type Revision = {
    id: number;
    sheet_number?: string | null;
    revision_number?: string | null;
    revision_date?: string | null;
    status: string;
    created_at: string;
    thumbnail_path?: string | null;
    thumbnail_s3_key?: string | null;
    page_preview_s3_key?: string | null;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    diff_image_path?: string | null;
    file_url?: string;
    page_preview_url?: string;
    thumbnail_url?: string;
    diff_image_url?: string;
};

export type TilesInfo = {
    baseUrl: string;
    maxZoom: number;
    minNativeZoom?: number;
    width: number;
    height: number;
    tileSize: number;
};

export type Drawing = {
    id: number;
    project_id: number;
    project?: Project;
    sheet_number?: string | null;
    title?: string | null;
    discipline?: string | null;
    display_name?: string;
    file_url?: string | null;
    pdf_url?: string | null;
    page_preview_url?: string | null;
    observations?: Observation[];
    previous_revision?: {
        id: number;
        sheet_number?: string | null;
        revision_number?: string | null;
    };
    revision_number?: string | null;
    diff_image_url?: string | null;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    tiles_info?: TilesInfo | null;
    storage_path?: string | null;
    original_name?: string | null;
    mime_type?: string | null;
    quantity_multiplier?: number;
    floor_label?: string | null;
};

export type PendingPoint = {
    pageNumber: number;
    x: number;
    y: number;
};

export type VariationSummary = {
    id: number;
    co_number: string;
    description: string;
    status: string;
};

export type AIComparisonChange = {
    type: string;
    description: string;
    location: string;
    impact: string;
    potential_change_order: boolean;
    reason?: string;
    page_number?: number;
    coordinates?: {
        page?: number;
        x: number;
        y: number;
        width?: number;
        height?: number;
        reference?: string;
    };
};

export type AIComparisonResult = {
    summary: string | null;
    changes: AIComparisonChange[];
    confidence?: string;
    notes?: string;
};
