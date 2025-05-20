import { themeQuartz } from 'ag-grid-community';

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
