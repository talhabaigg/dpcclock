<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Maintenance — {{ config('app.name', 'DPC Clock') }}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="30">
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
    <style>
        @keyframes dpc-indeterminate {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(250%); }
        }
        .dpc-progress-track::after {
            content: '';
            position: absolute;
            inset: 0;
            width: 40%;
            background: var(--primary);
            border-radius: inherit;
            animation: dpc-indeterminate 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
    </style>
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
                <span class="relative flex size-1.5">
                    <span class="bg-muted-foreground/60 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                    <span class="bg-muted-foreground/80 relative inline-flex size-1.5 rounded-full"></span>
                </span>
                Maintenance · 503
            </div>

            <h1 class="text-foreground mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                We’ll be right back
            </h1>

            <p class="text-muted-foreground mt-3 text-sm leading-6 sm:text-base">
                We’re performing a quick update to improve your experience.
                This should only take a moment.
            </p>

            <div class="mt-8 w-full max-w-xs">
                <div class="dpc-progress-track bg-muted relative h-1 w-full overflow-hidden rounded-full"></div>
            </div>

            <p class="text-muted-foreground/70 mt-4 font-mono text-[11px] tracking-wider uppercase">
                This page will auto-refresh
            </p>
        </div>

        <footer class="text-muted-foreground/70 mt-16 font-mono text-[11px] tracking-wider uppercase">
            {{ config('app.name', 'DPC Clock') }}
        </footer>
    </main>

</body>

</html>
