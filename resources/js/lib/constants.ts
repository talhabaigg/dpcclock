// Panel dimension constraints (pixels)
export const PANEL_MIN_WIDTH = 200;
export const PANEL_MAX_WIDTH = 480;
export const PANEL_DEFAULT_WIDTH = 256;

// Preset color palette for measurements
export const PRESET_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

// Paper sizes for calibration
export const PAPER_SIZES = ['A0', 'A1', 'A2', 'A3', 'A4'] as const;

// Scale options for calibration
export const SCALE_OPTIONS = [
    '1:1', '1:2', '1:5', '1:10', '1:20', '1:25',
    '1:50', '1:100', '1:200', '1:250', '1:500', '1:1000', 'Custom',
] as const;

// Unit options for calibration
export const UNIT_OPTIONS = [
    { value: 'mm', label: 'mm' },
    { value: 'cm', label: 'cm' },
    { value: 'm', label: 'm' },
    { value: 'in', label: 'in' },
    { value: 'ft', label: 'ft' },
] as const;
