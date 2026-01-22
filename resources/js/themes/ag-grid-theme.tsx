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
    fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    foregroundColor: '#1e293b',
    headerBackgroundColor: '#f1f5f9',
    headerFontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
