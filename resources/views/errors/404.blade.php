<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>404 - Page Not Found</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    @vite('resources/css/app.css') {{-- Tailwind --}}
</head>

<body
    class="bg-background text-foreground flex items-center justify-center min-h-screen px-6 dark:bg-gray-950 dark:text-white">

    <div
        class="rounded-2xl shadow-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 max-w-md w-full text-center space-y-4 transition-all">
        <div class="flex justify-center">
            <div
                class="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 rounded-full p-3 w-16 h-16 flex items-center justify-center text-3xl font-bold shadow-inner">
                404
            </div>
        </div>

        <h1 class="text-2xl font-semibold tracking-tight">Page Not Found</h1>

        <p class="text-gray-600 dark:text-gray-400">
            Sorry, we couldn’t find the page you were looking for.
        </p>

        <div class="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            <a href="{{ url('/') }}"
                class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors dark:bg-blue-600 dark:hover:bg-blue-500">
                Go to Homepage
            </a>
        </div>
    </div>

</body>

</html>
