/**
 * Labour Forecast Partials Index
 *
 * This file exports all partial components used by the labour forecast show page.
 * Components are organized by function:
 *
 * DIALOGS:
 * - SettingsDialog: Configure pay rate templates
 * - TemplateCostBreakdownDialog: View cost breakdown for a template
 * - AllowanceConfigDialog: Configure custom allowances
 * - RejectionDialog: Reject a forecast with reason
 * - ChartDialog: Full-screen chart view
 *
 * PAGE SECTIONS:
 * - ForecastHeader: Title, status, navigation, action buttons
 * - StatusBanners: Informational banners based on workflow state
 * - InlineChartSection: Compact chart on main page
 * - SummaryCards: Key metrics display
 * - ForecastNotesSection: Collapsible notes area
 * - ForecastGrid: AG Grid data entry
 *
 * SHARED COMPONENTS:
 * - CategoryToggleButtons: Work type category filter
 * - TimeRangeToggle: Chart time range filter
 *
 * UTILITIES:
 * - utils: Shared formatting and calculation functions
 */

// Dialogs
export { AllowanceConfigDialog } from './AllowanceConfigDialog';
export { ChartDialog } from './ChartDialog';
export { RejectionDialog } from './RejectionDialog';
export { SettingsDialog } from './SettingsDialog';
export { TemplateCostBreakdownDialog } from './TemplateCostBreakdownDialog';

// Page Sections
export { ForecastGrid } from './ForecastGrid';
export { ForecastHeader } from './ForecastHeader';
export { ForecastNotesSection } from './ForecastNotesSection';
export { InlineChartSection } from './InlineChartSection';
export { StatusBanners } from './StatusBanners';
export { SummaryCards } from './SummaryCards';

// Shared Components
export { CategoryToggleButtons } from './CategoryToggleButtons';
export { TimeRangeToggle } from './TimeRangeToggle';

// Utilities
export * from './utils';
