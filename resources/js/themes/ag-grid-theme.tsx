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
    accentColor: 'hsl(var(--primary))',
    backgroundColor: 'hsl(var(--background))',
    borderColor: 'hsl(var(--border))',
    borderWidth: 1,
    browserColorScheme: 'inherit',
    cellHorizontalPaddingScale: 0.55,
    columnBorder: true,
    dataFontSize: 10,
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    foregroundColor: 'hsl(var(--foreground))',
    headerBackgroundColor: 'hsl(var(--muted))',
    headerFontFamily: 'var(--font-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    headerFontSize: 10,
    headerFontWeight: 700,
    headerTextColor: 'hsl(var(--foreground))',
    headerVerticalPaddingScale: 0.5,
    oddRowBackgroundColor: 'hsl(var(--muted) / 0.35)',
    rowBorder: true,
    rowVerticalPaddingScale: 0.4,
    wrapperBorder: true,
    wrapperBorderRadius: '12px',
    borderRadius: '12px',
    menuBackgroundColor: 'hsl(var(--popover))',
    pickerListBackgroundColor: 'hsl(var(--popover))',
    listItemHeight: 20,
    menuShadow: { radius: 10, spread: 5, color: 'hsl(var(--border))' },
});
