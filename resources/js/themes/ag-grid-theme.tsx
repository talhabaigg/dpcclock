import { themeQuartz } from 'ag-grid-community';

export const myTheme = themeQuartz.withParams({
    fontFamily: {
        googleFont: 'Instrument Sans',
    },
    headerBackgroundColor: '#00000000',
    wrapperBorderRadius: '10px',
    wrapperBorder: false,
    columnBorder: true,
});

export const darkTheme = themeQuartz.withParams({
    accentColor: '#9596cc',
    backgroundColor: '#020000',
    browserColorScheme: 'inherit',
    cellHorizontalPaddingScale: 1,

    chromeBackgroundColor: '#00000000',
    fontFamily: 'inherit',
    foregroundColor: '#FFF',

    headerFontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Oxygen-Sans',
        'Ubuntu',
        'Cantarell',
        'Helvetica Neue',
        'sans-serif',
    ],
    headerFontSize: 14,
    headerFontWeight: 500,
    headerTextColor: '#FFFFFF',
    headerVerticalPaddingScale: 1,
    oddRowBackgroundColor: '#060606',
    rowVerticalPaddingScale: 1,
    wrapperBorder: false,
});

export const shadcnTheme = themeQuartz.withParams({
    accentColor: '#6366f1',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    browserColorScheme: 'light',
    cellHorizontalPaddingScale: 1,
    columnBorder: true,
    rowBorder: true,
    dataFontSize: 13,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    foregroundColor: '#1e293b',
    headerBackgroundColor: '#f1f5f9',
    headerFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    headerFontSize: 12,
    headerFontWeight: 600,
    headerTextColor: '#334155',
    headerVerticalPaddingScale: 1.1,
    oddRowBackgroundColor: '#f8fafc',
    rowVerticalPaddingScale: 0.9,
    wrapperBorder: true,
    wrapperBorderRadius: '12px',
    borderRadius: '8px',
    selectedRowBackgroundColor: '#e0f2fe',
    rangeSelectionBackgroundColor: '#dbeafe',
    rangeSelectionBorderColor: '#3b82f6',
    menuBackgroundColor: '#ffffff',
    pickerListBackgroundColor: '#ffffff',
    listItemHeight: 38,
    menuShadow: { radius: 16, spread: -4, color: 'rgba(0, 0, 0, 0.15)' },
    cardShadow: { radius: 16, spread: -4, color: 'rgba(0, 0, 0, 0.1)' },
    popupShadow: { radius: 20, spread: -4, color: 'rgba(0, 0, 0, 0.15)' },
    spacing: 8,
    rowHeight: 40,
    headerHeight: 44,
});

// Shadcn-inspired theme - clean minimal look matching shadcn/ui table
export const shadcnLightTheme = themeQuartz.withParams({
    // Colors - using transparent/white backgrounds like shadcn table
    accentColor: '#18181b', // zinc-900 (primary)
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7', // zinc-200
    browserColorScheme: 'light',
    foregroundColor: '#18181b', // zinc-900

    // Header - clean, no background, just border bottom
    headerBackgroundColor: '#ffffff',
    headerTextColor: '#71717a', // zinc-500 (muted-foreground)
    headerFontSize: 12,
    headerFontWeight: 500,
    headerVerticalPaddingScale: 0.9,
    headerHeight: 40,

    // Row styling - minimal, clean
    oddRowBackgroundColor: '#ffffff',
    rowHeight: 48,
    rowVerticalPaddingScale: 1,
    selectedRowBackgroundColor: '#f4f4f5', // zinc-100 (muted)
    rangeSelectionBackgroundColor: '#f4f4f5',

    // Typography
    fontFamily: 'inherit',
    headerFontFamily: 'inherit',
    dataFontSize: 14,

    // Borders - subtle, only row borders
    cellHorizontalPaddingScale: 0.8,
    columnBorder: false,
    rowBorder: true,
    wrapperBorder: true,
    wrapperBorderRadius: '8px',
    borderRadius: '6px',
    spacing: 8,
});

export const shadcnDarkTheme = themeQuartz.withParams({
    // Colors - dark mode matching shadcn
    accentColor: '#fafafa', // zinc-50 (primary dark)
    backgroundColor: '#09090b', // zinc-950
    borderColor: '#27272a', // zinc-800
    browserColorScheme: 'dark',
    foregroundColor: '#fafafa', // zinc-50

    // Header - clean, transparent
    headerBackgroundColor: '#09090b',
    headerTextColor: '#a1a1aa', // zinc-400 (muted-foreground dark)
    headerFontSize: 12,
    headerFontWeight: 500,
    headerVerticalPaddingScale: 0.9,
    headerHeight: 40,

    // Row styling
    oddRowBackgroundColor: '#09090b',
    rowHeight: 48,
    rowVerticalPaddingScale: 1,
    selectedRowBackgroundColor: '#27272a', // zinc-800 (muted dark)
    rangeSelectionBackgroundColor: '#27272a',

    // Typography
    fontFamily: 'inherit',
    headerFontFamily: 'inherit',
    dataFontSize: 14,

    // Borders
    cellHorizontalPaddingScale: 0.8,
    columnBorder: false,
    rowBorder: true,
    wrapperBorder: true,
    wrapperBorderRadius: '8px',
    borderRadius: '6px',
    spacing: 8,
});
