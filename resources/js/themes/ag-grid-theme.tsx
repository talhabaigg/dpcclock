import { themeQuartz } from 'ag-grid-community';

const baseParams = {
    fontFamily: 'inherit',
    headerFontFamily: 'inherit',
    headerFontSize: 14,
    headerFontWeight: 500,
    headerHeight: 40,
    headerVerticalPaddingScale: 0.8,
    dataFontSize: 14,
    rowHeight: 40,
    rowVerticalPaddingScale: 0.8,
    cellHorizontalPaddingScale: 0.8,
    columnBorder: false,
    rowBorder: true,
    wrapperBorder: false,
    wrapperBorderRadius: '8px',
    borderRadius: '6px',
    spacing: 8,
};

export const shadcnLightTheme = themeQuartz.withParams({
    ...baseParams,
    browserColorScheme: 'light',
    backgroundColor: '#ffffff',
    foregroundColor: '#18181b',
    headerBackgroundColor: '#ffffff',
    headerTextColor: '#71717a',
    oddRowBackgroundColor: '#ffffff',
    chromeBackgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
    selectedRowBackgroundColor: '#f4f4f5',
    rowHoverColor: '#f4f4f580',
});

export const shadcnDarkTheme = themeQuartz.withParams({
    ...baseParams,
    browserColorScheme: 'dark',
    backgroundColor: '#000000',
    foregroundColor: '#fbfbfb',
    headerBackgroundColor: '#000000',
    headerTextColor: '#a1a1aa',
    oddRowBackgroundColor: '#000000',
    chromeBackgroundColor: '#000000',
    borderColor: '#27272a',
    selectedRowBackgroundColor: '#27272a',
    rowHoverColor: '#27272a80',
});
