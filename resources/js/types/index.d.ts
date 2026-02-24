import { LucideIcon } from 'lucide-react';
import type { Config } from 'ziggy-js';

export interface Auth {
    user: User;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    adminOnly?: boolean;
    permission?: string;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    ziggy: Config & { location: string };
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    phone: string | null; // Added phone field to User model
    [key: string]: unknown; // This allows for additional properties...
}

export interface JobSummary {
    id: number;
    job_number: string;
    company_code: string;
    start_date: string;
    estimated_end_date: string;
    actual_end_date: string | null;
    status: string;
    original_estimate_cost: number;
    current_estimate_cost: number;
    original_estimate_revenue: number;
    current_estimate_revenue: number;
    over_under_billing: number;
    created_at: string;
    updated_at: string;
}

export interface Location {
    id: number;
    name: string;
    eh_location_id: string;
    eh_parent_id: string;
    external_id: string;
    state: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    [key: string]: unknown;
}
