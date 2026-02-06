<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Maintenance - {{ config('app.name', 'DPC Clock') }}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="30">
    <style>
        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: #f8fafc;
            color: #1e293b;
        }

        .card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 1rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
            padding: 2.5rem 2rem;
            max-width: 28rem;
            width: 100%;
            text-align: center;
        }

        .icon-wrapper {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
        }

        .icon {
            width: 4rem;
            height: 4rem;
            border-radius: 50%;
            background: #fef3c7;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 2s ease-in-out infinite;
        }

        .icon svg {
            width: 1.75rem;
            height: 1.75rem;
            color: #d97706;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }

        h1 {
            font-size: 1.5rem;
            font-weight: 600;
            letter-spacing: -0.025em;
            margin-bottom: 0.5rem;
        }

        p {
            color: #64748b;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }

        .progress-bar {
            width: 100%;
            height: 4px;
            background: #e2e8f0;
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 1rem;
        }

        .progress-bar-inner {
            height: 100%;
            width: 30%;
            background: linear-gradient(90deg, #3b82f6, #6366f1);
            border-radius: 2px;
            animation: loading 2s ease-in-out infinite;
        }

        @keyframes loading {
            0% { transform: translateX(-100%); width: 30%; }
            50% { width: 60%; }
            100% { transform: translateX(400%); width: 30%; }
        }

        .meta {
            font-size: 0.8rem;
            color: #94a3b8;
        }

        @media (prefers-color-scheme: dark) {
            body {
                background: #0f172a;
                color: #f1f5f9;
            }

            .card {
                background: #1e293b;
                border-color: #334155;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            }

            .icon {
                background: #422006;
            }

            .icon svg {
                color: #fbbf24;
            }

            p {
                color: #94a3b8;
            }

            .progress-bar {
                background: #334155;
            }

            .meta {
                color: #64748b;
            }
        }
    </style>
</head>

<body>
    <div class="card">
        <div class="icon-wrapper">
            <div class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.193-.14 1.743" />
                </svg>
            </div>
        </div>

        <h1>We'll be right back</h1>
        <p>We're performing a quick update to improve your experience. This should only take a moment.</p>

        <div class="progress-bar">
            <div class="progress-bar-inner"></div>
        </div>

        <span class="meta">This page will auto-refresh</span>
    </div>
</body>

</html>
