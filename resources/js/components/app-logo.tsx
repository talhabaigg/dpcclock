import { useEffect, useState } from 'react';
import AppLogoIcon from './app-logo-icon'; // Light mode logo
import AppLogoIconDark from './app-logo-icon-dark'; // Dark mode logo

export default function AppLogo() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Initialize state based on the current dark mode setting
        return document.documentElement.classList.contains('dark');
    });

    // Check if the dark mode class is present in the body
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const darkModeEnabled = document.documentElement.classList.contains('dark');
            setIsDarkMode(darkModeEnabled);
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <div className="bg-sidebar-secondary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                {isDarkMode ? (
                    <AppLogoIconDark className="size-5 fill-current text-white" />
                ) : (
                    <AppLogoIcon className="size-5 fill-current text-white" />
                )}
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-none font-semibold">Superior Group</span>
            </div>
        </>
    );
}
