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
    is_confirmed?: boolean;
    confirmed_at?: string | null;
    confirmed_by?: number | null;
    // Legacy AI comparison fields — feature removed but columns remain
    source?: string | null;
    ai_change_type?: string | null;
    ai_impact?: 'low' | 'medium' | 'high' | null;
    ai_location?: string | null;
    potential_change_order?: boolean;
};

export type Revision = {
    id: number;
    sheet_number?: string | null;
    revision_number?: string | null;
    title?: string | null;
    status: string;
    created_at: string;
    file_url?: string | null;
    thumbnail_url?: string | null;
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
    display_name?: string;
    file_url?: string | null;
    thumbnail_url?: string | null;
    observations?: Observation[];
    previous_revision?: {
        id: number;
        sheet_number?: string | null;
        revision_number?: string | null;
    };
    revision_number?: string | null;
    tiles_info?: TilesInfo | null;
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
