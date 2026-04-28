import { themeQuartz } from 'ag-grid-community';

const compactParams = {
    fontFamily: 'inherit',
    headerFontFamily: 'inherit',
    headerFontSize: 12,
    headerFontWeight: 500,
    headerHeight: 28,
    headerVerticalPaddingScale: 0,
    dataFontSize: 12,
    rowHeight: 28,
    rowVerticalPaddingScale: 0,
    cellHorizontalPaddingScale: 0.7,
    columnBorder: false,
    rowBorder: true,
    wrapperBorder: false,
    wrapperBorderRadius: '0px',
    borderRadius: '4px',
    spacing: 2,
};

export const compactLightTheme = themeQuartz.withParams({
    ...compactParams,
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

export const compactDarkTheme = themeQuartz.withParams({
    ...compactParams,
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
