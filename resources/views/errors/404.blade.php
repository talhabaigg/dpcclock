<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>404 — Page Not Found</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    {{-- Match the SPA's dark-mode class before paint to avoid a flash --}}
    <script>
        (function () {
            try {
                var saved = localStorage.getItem('appearance') || 'system';
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var isDark = saved === 'dark' || (saved === 'system' && prefersDark);
                if (isDark) document.documentElement.classList.add('dark');
            } catch (e) {}
        })();
    </script>
    @vite('resources/css/app.css')
</head>

<body class="bg-background text-foreground min-h-screen antialiased">

    <main class="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
        {{-- subtle grid backdrop --}}
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] opacity-40">
        </div>

        <div class="flex w-full max-w-md flex-col items-center text-center">
            <div
                class="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs">
                <span class="bg-muted-foreground/60 size-1.5 rounded-full"></span>
                Error 404
            </div>

            <h1 class="text-foreground mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                Page not found
            </h1>

            <p class="text-muted-foreground mt-3 text-sm leading-6 sm:text-base">
                The page you’re looking for doesn’t exist or has been moved.
                Check the URL or head back to safety.
            </p>

            <div class="mt-8 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
                <button
                    type="button"
                    onclick="window.history.length > 1 ? window.history.back() : (window.location.href = '{{ url('/') }}')"
                    class="border-input bg-background hover:bg-accent hover:text-accent-foreground ring-offset-background focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5" />
                        <path d="m12 19-7-7 7-7" />
                    </svg>
                    Go back
                </button>

                <a href="{{ url('/') }}"
                    class="bg-primary text-primary-foreground hover:bg-primary/90 ring-offset-background focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                    Return home
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                    </svg>
                </a>
            </div>
        </div>

        <footer class="text-muted-foreground/70 mt-16 font-mono text-[11px] tracking-wider uppercase">
            {{ config('app.name', 'DPC Clock') }}
        </footer>
    </main>

</body>

</html>
