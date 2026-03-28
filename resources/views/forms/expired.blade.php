<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Form Unavailable</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { max-width: 480px; margin: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px 32px; text-align: center; }
        .icon { width: 64px; height: 64px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .icon svg { width: 32px; height: 32px; color: #d97706; }
        h1 { font-size: 22px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
        p { font-size: 15px; color: #64748b; }
        .logo { max-height: 36px; margin-bottom: 24px; }
    </style>
</head>
<body>
    <div class="card">
        <img src="{{ asset('logo.png') }}" alt="DPC" class="logo">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
        </div>
        <h1>Form Unavailable</h1>
        <p>{{ $message ?? 'This form link has expired or been cancelled. Please contact the sender if you need a new link.' }}</p>
    </div>
</body>
</html>
