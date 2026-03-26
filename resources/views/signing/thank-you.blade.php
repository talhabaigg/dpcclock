<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Signed</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 48px; text-align: center; max-width: 500px; width: 100%; margin: 20px; }
        .icon { width: 64px; height: 64px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .icon svg { width: 32px; height: 32px; color: #16a34a; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
        p { font-size: 15px; color: #64748b; line-height: 1.6; }
        .name { font-weight: 600; color: #1e293b; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        </div>
        <h1>Document Signed Successfully</h1>
        <p>
            Thank you, <span class="name">{{ $signingRequest->signer_full_name }}</span>.
            Your signature has been recorded. A copy of the signed document will be sent to your email.
        </p>
    </div>
</body>
</html>
