# Job Forecast Module

This directory contains the refactored Job Forecast feature with improved code organization and maintainability.

## File Structure

```
job-forecast/
├── show.tsx                 # Main component (258 lines, down from 1,252)
├── types.ts                 # TypeScript type definitions
├── utils.ts                 # Utility functions (calculations, formatting)
├── hooks.ts                 # Custom React hooks
├── column-builders.tsx      # AG Grid column definition builders
├── Sparkline.tsx           # Sparkline trend chart component
├── ForecastDialogChart.tsx # Interactive forecast editing chart
└── README.md               # This file
```

## Component Overview

### show.tsx
**Main Page Component** - Orchestrates the entire job forecast interface with two synchronized AG Grid tables (cost and revenue).

**Key Features:**
- Dual synchronized grids for cost and revenue tracking
- Interactive chart dialog for forecast editing
- Persistent column state via localStorage
- Real-time cell updates and refreshing

### types.ts
**Type Definitions** - All TypeScript interfaces and types used across the module.

**Exports:**
- `JobForecastProps` - Main component props
- `ChartRow` - Chart data structure
- `GridRow` - Grid row with unique key
- `ChartContext` - Chart dialog state
- `ChartMeta` - Chart metadata for rendering

### utils.ts
**Utility Functions** - Pure functions for common operations.

**Functions:**
- `toNumberOrNull()` - Safe number parsing with null fallback
- `sumMonths()` - Aggregate monthly values
- `formatMonthHeader()` - Format month strings (e.g., "Nov 25")
- `withRowKeys()` - Add unique keys to row data

### hooks.ts
**Custom React Hooks** - Encapsulated business logic and state management.

**Hooks:**
- `useDisplayMonths()` - Calculate visible month range
- `useForecastCalculations()` - Forecast math (totals, percentages)
- `useTrendColumnDef()` - Generate sparkline column definitions
- `usePinnedRowData()` - Calculate totals for pinned rows
- `useChartRowsBuilder()` - Transform data for chart display
- `useActiveChartData()` - Manage active chart data

**Utilities:**
- `saveColState()` / `restoreColState()` - Persist column state

### column-builders.tsx
**Column Definition Builders** - AG Grid column configurations.

**Functions:**
- `buildCostColumnDefs()` - Cost grid columns with actuals, forecasts, percentages
- `buildRevenueColumnDefs()` - Revenue grid columns with similar structure

Both builders support:
- Editable forecast cells
- Percentage-based editing (cumulative %)
- Dynamic month columns
- Computed totals and remainders

### Sparkline.tsx
**Sparkline Component** - Inline SVG trend visualization.

**Props:**
- `values` - Array of numbers to plot
- `width` - Chart width (default: 72px)
- `height` - Chart height (default: 22px)

**Features:**
- Auto-scaling to data range
- Handles null/missing values
- Minimal visual footprint

### ForecastDialogChart.tsx
**Forecast Chart Dialog** - Full-featured editing interface using Chart.js.

**Props:**
- `data` - Chart rows with actual/forecast split
- `editable` - Enable/disable editing
- `onEdit` - Callback for value changes

**Features:**
- Drag-and-drop point editing
- Click-to-edit with input box
- Visual distinction between actuals (yellow) and forecasts (blue)
- Dashed lines for forecast segments

## Key Improvements

### Before Refactoring
- Single 1,252-line file
- Tightly coupled logic
- Difficult to test individual pieces
- Hard to navigate and understand
- Duplicate utility code

### After Refactoring
- **80% reduction** in main component size (1,252 → 258 lines)
- **Clear separation of concerns** across 7 focused files
- **Reusable hooks and utilities** for better testing
- **Self-documenting code** with clear section headers
- **Improved maintainability** and scalability

## Usage Example

```tsx
import ShowJobForecastPage from '@/pages/job-forecast/show';

<ShowJobForecastPage
  costRowData={costs}
  revenueRowData={revenues}
  monthsAll={['2025-01', '2025-02', ...]}
  forecastMonths={['2025-06', '2025-07', ...]}
  projectEndMonth="2025-12"
/>
```

## Development Notes

### Adding New Features
1. **New calculations?** → Add to `utils.ts` or create hook in `hooks.ts`
2. **New columns?** → Extend `column-builders.tsx`
3. **New components?** → Create alongside with clear name
4. **New types?** → Add to `types.ts`

### Testing Strategy
- Test pure functions in `utils.ts` independently
- Test hooks with React Testing Library
- Test column builders with mock AG Grid contexts
- Test components in isolation

### Performance Considerations
- All heavy calculations are memoized with `useMemo`
- Callbacks are stabilized with `useCallback`
- Grid updates use targeted cell refresh, not full re-render
- Column definitions are built once per dependency change

## Architecture Patterns

### Custom Hooks Pattern
Complex logic is extracted into custom hooks that:
- Accept configuration as props
- Return computed values or callbacks
- Use proper dependency arrays
- Are composable and testable

### Builder Pattern
Column definitions use builder functions that:
- Accept all dependencies explicitly
- Return complete column configurations
- Support different grid types (cost/revenue)
- Keep main component clean

### Separation of Concerns
- **Presentation**: Components (`.tsx`)
- **Logic**: Hooks (`.ts`)
- **Data**: Utilities and types (`.ts`)
- **Configuration**: Column builders (`.tsx`)

## Future Enhancements

Potential improvements:
- [ ] Add unit tests for utils and hooks
- [ ] Extract grid configuration to constants
- [ ] Add data persistence (API integration)
- [ ] Implement undo/redo for edits
- [ ] Add export functionality (Excel, PDF)
- [ ] Improve mobile responsiveness
- [ ] Add keyboard navigation shortcuts
- [ ] Implement bulk editing features
