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
export { SettingsDialog } from './SettingsDialog';
export { TemplateCostBreakdownDialog } from './TemplateCostBreakdownDialog';
export { AllowanceConfigDialog } from './AllowanceConfigDialog';
export { RejectionDialog } from './RejectionDialog';
export { ChartDialog } from './ChartDialog';

// Page Sections
export { ForecastHeader } from './ForecastHeader';
export { StatusBanners } from './StatusBanners';
export { InlineChartSection } from './InlineChartSection';
export { SummaryCards } from './SummaryCards';
export { ForecastNotesSection } from './ForecastNotesSection';
export { ForecastGrid } from './ForecastGrid';

// Shared Components
export { CategoryToggleButtons } from './CategoryToggleButtons';
export { TimeRangeToggle } from './TimeRangeToggle';

// Utilities
export * from './utils';
