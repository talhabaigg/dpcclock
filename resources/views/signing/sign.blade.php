<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Sign Agreement</title>
    @vite(['resources/js/signing.ts'])
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; }
        .container { max-width: 720px; margin: 0 auto; padding: 20px 16px; }

        /* Header */
        .header { text-align: center; padding: 24px 0 20px; }
        .header img { max-height: 44px; margin-bottom: 12px; }
        .header h1 { font-size: 20px; font-weight: 600; color: #0f172a; }
        .header p { font-size: 14px; color: #64748b; margin-top: 2px; }

        /* Greeting */
        .greeting { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; font-size: 15px; color: #334155; }
        .greeting strong { color: #0f172a; }

        /* Agreement content card */
        .agreement-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
        .agreement-header { padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
        .agreement-header h2 { font-size: 14px; font-weight: 600; color: #334155; }
        .scroll-hint { font-size: 12px; color: #94a3b8; transition: opacity 0.3s; }
        .scroll-hint.hidden { opacity: 0; }
        .agreement-body { padding: 24px 28px; max-height: 65vh; overflow-y: auto; scroll-behavior: smooth; }

        /* Style the TipTap HTML content */
        .agreement-body h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 24px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
        .agreement-body h1:first-child { margin-top: 0; }
        .agreement-body h2 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 20px 0 6px; }
        .agreement-body h3 { font-size: 14px; font-weight: 600; color: #334155; margin: 16px 0 4px; }
        .agreement-body p { font-size: 14px; line-height: 1.7; color: #374151; margin: 4px 0 8px; }
        .agreement-body ul { padding-left: 24px; margin: 6px 0 12px; list-style-type: disc; }
        .agreement-body ol { padding-left: 24px; margin: 6px 0 12px; list-style-type: decimal; }
        .agreement-body li { font-size: 14px; line-height: 1.6; color: #374151; margin: 2px 0; }
        .agreement-body table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 16px 0; font-size: 13px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .agreement-body th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 1px 6px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; color: #334155; }
        .agreement-body th:last-child { border-right: none; }
        .agreement-body td { padding: 1px 6px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; color: #374151; }
        .agreement-body td:last-child { border-right: none; }
        .agreement-body tr:last-child td { border-bottom: none; }
        .agreement-body strong { font-weight: 600; color: #1e293b; }
        .agreement-body .signature-placeholder { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 24px; text-align: center; color: #94a3b8; margin: 20px 0; font-style: italic; font-size: 13px; background: #f8fafc; }
        .agreement-body .signature-box { margin: 20px 0; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
        .agreement-body .signature-box img { max-width: 300px; max-height: 100px; }
        .agreement-body .signature-meta { margin-top: 8px; font-size: 12px; color: #64748b; line-height: 1.5; }
        .agreement-body blockquote { border-left: 3px solid #2563eb; padding: 8px 16px; margin: 12px 0; background: #eff6ff; border-radius: 0 8px 8px 0; font-size: 14px; color: #1e40af; }
        .agreement-body img { max-width: 300px; max-height: 100px; }

        /* Read confirmation */
        .read-confirmation { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; opacity: 0.4; pointer-events: none; transition: opacity 0.3s; }
        .read-confirmation.active { opacity: 1; pointer-events: auto; }
        .read-confirmation label { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; font-size: 14px; font-weight: 500; color: #334155; line-height: 1.5; }
        .read-confirmation input[type="checkbox"] { width: 20px; height: 20px; margin-top: 2px; accent-color: #2563eb; flex-shrink: 0; }

        /* Signature section */
        .signature-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; display: none; }
        .signature-section.visible { display: block; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .signature-section h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #374151; }
        .form-group input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; color: #1e293b; background: #fff; }
        .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .canvas-wrapper { border: 2px solid #d1d5db; border-radius: 10px; background: #fff; margin-bottom: 10px; touch-action: none; overflow: hidden; }
        .canvas-wrapper canvas { display: block; width: 100%; border-radius: 8px; }
        .canvas-actions { display: flex; gap: 8px; margin-bottom: 16px; }
        .canvas-actions button { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; font-size: 13px; cursor: pointer; color: #374151; transition: background 0.15s; }
        .canvas-actions button:hover { background: #f3f4f6; }
        .consent-text { font-size: 13px; color: #64748b; margin-bottom: 16px; line-height: 1.6; }
        .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .submit-btn:hover { background: #1d4ed8; }
        .submit-btn:disabled { background: #93c5fd; cursor: not-allowed; }
        .error-msg { color: #dc2626; font-size: 13px; margin-top: 6px; display: none; }
        .error-msg.visible { display: block; }

        /* Footer */
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #94a3b8; }

        /* Mobile */
        @media (max-width: 640px) {
            .container { padding: 12px; }
            .agreement-body { padding: 16px; max-height: 55vh; }
            .agreement-body h1 { font-size: 18px; }
            .agreement-body h2 { font-size: 15px; }
            .agreement-body p, .agreement-body li { font-size: 13px; }
            .agreement-body th, .agreement-body td { padding: 6px 8px; font-size: 12px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('logo.png') }}" alt="DPC">
            <h1>{{ $signingRequest->documentTemplate?->name ?? 'Agreement' }}</h1>
            <p>Please review and sign below</p>
        </div>

        <div class="greeting">
            Hi <strong>{{ $signingRequest->recipient_name }}</strong>, please read through the agreement below and provide your signature at the end.
        </div>

        @php
            $totalPending = ($pendingForms ?? collect())->count() + ($pendingDocs ?? collect())->count();
        @endphp
        @if($totalPending > 0)
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; font-size: 14px; color: #1e40af;">
                Step 1 of {{ $totalPending + 1 }} &mdash; after signing this document you'll be taken to the next item automatically.
            </div>
        @endif

        <div class="agreement-card">
            <div class="agreement-header">
                <h2>Agreement</h2>
                <span class="scroll-hint" id="scroll-hint">Scroll to read all &darr;</span>
            </div>
            <div class="agreement-body" id="agreement-body">
                {!! $displayHtml !!}
                <div id="agreement-end" style="height: 1px;"></div>
            </div>
        </div>

        <div class="read-confirmation" id="read-confirmation">
            <label>
                <input type="checkbox" id="read-checkbox">
                I have read and understood this agreement
            </label>
        </div>

        <form id="signing-form" class="signature-section" method="POST" action="{{ route('signing.submit', $token) }}">
            @csrf
            <h3>Your Signature</h3>

            <div class="form-group">
                <label for="signer_full_name">Full Legal Name</label>
                <input type="text" id="signer_full_name" name="signer_full_name" value="{{ $signingRequest->recipient_name }}" required>
            </div>

            <div class="form-group">
                <label>Draw your signature below</label>
            </div>
            <div class="canvas-wrapper">
                <canvas id="signature-canvas" height="200"></canvas>
            </div>
            <div class="canvas-actions">
                <button type="button" id="clear-btn">Clear</button>
                <button type="button" id="undo-btn">Undo</button>
            </div>
            <p id="signature-error" class="error-msg">Please draw your signature before submitting.</p>

            <input type="hidden" name="signature_data" id="signature-data">

            <p class="consent-text">
                By signing below, I confirm that I have read and agree to the terms of this agreement.
                I consent to signing this document electronically in accordance with the
                Electronic Transactions Act 1999 (Cth).
            </p>

            <button type="submit" class="submit-btn" id="submit-btn" disabled>Sign Agreement</button>
        </form>

        <div class="footer">
            This link expires {{ $signingRequest->expires_at->timezone('Australia/Sydney')->format('d M Y \\a\\t h:i A') }} AEST
        </div>
    </div>

    <script>
        window.__signing_token = @json($token);
        window.__viewed_url = @json(route('signing.viewed', $token));
    </script>
</body>
</html>
