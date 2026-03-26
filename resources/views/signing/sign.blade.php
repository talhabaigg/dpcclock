<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Sign Document</title>
    @vite(['resources/js/signing.ts'])
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
        .header h1 { font-size: 20px; font-weight: 600; color: #0f172a; }
        .header p { font-size: 14px; color: #64748b; margin-top: 4px; }
        .greeting { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 15px; }
        .document-body { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px; margin-bottom: 24px; max-height: 60vh; overflow-y: auto; line-height: 1.7; }
        .document-body h1, .document-body h2, .document-body h3 { margin-top: 1em; margin-bottom: 0.5em; }
        .document-body table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        .document-body th, .document-body td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
        .document-body th { background: #f3f4f6; font-weight: 600; }
        .document-body ul, .document-body ol { padding-left: 24px; }
        .signature-box-placeholder { border: 2px dashed #94a3b8; border-radius: 8px; padding: 20px; text-align: center; color: #94a3b8; margin: 16px 0; font-style: italic; }
        .read-confirmation { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
        .read-confirmation label { display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 15px; font-weight: 500; }
        .read-confirmation input[type="checkbox"] { width: 20px; height: 20px; accent-color: #2563eb; }
        .signature-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px; display: none; }
        .signature-section.visible { display: block; }
        .signature-section h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #374151; }
        .form-group input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 15px; }
        .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .canvas-wrapper { border: 2px solid #d1d5db; border-radius: 8px; background: #fff; margin-bottom: 12px; touch-action: none; }
        .canvas-wrapper canvas { display: block; width: 100%; border-radius: 6px; }
        .canvas-actions { display: flex; gap: 8px; margin-bottom: 16px; }
        .canvas-actions button { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; font-size: 13px; cursor: pointer; color: #374151; }
        .canvas-actions button:hover { background: #f3f4f6; }
        .consent-text { font-size: 13px; color: #64748b; margin-bottom: 16px; line-height: 1.5; }
        .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .submit-btn:hover { background: #1d4ed8; }
        .submit-btn:disabled { background: #93c5fd; cursor: not-allowed; }
        .error-msg { color: #dc2626; font-size: 13px; margin-top: 4px; display: none; }
        .error-msg.visible { display: block; }
        .footer { text-align: center; padding: 24px 0; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('logo.png') }}" alt="DPC" style="max-height: 50px; margin: 0 auto 12px;">
            <h1>Document for Signature</h1>
            <p>{{ $signingRequest->documentTemplate?->name ?? 'Document' }}</p>
        </div>

        <div class="greeting">
            Hi <strong>{{ $signingRequest->recipient_name }}</strong>, please review the document below and provide your signature.
        </div>

        <div class="document-body">
            {!! $displayHtml !!}
        </div>

        <div class="read-confirmation">
            <label>
                <input type="checkbox" id="read-checkbox">
                I have read and understood this document
            </label>
        </div>

        <form id="signing-form" class="signature-section" method="POST" action="{{ route('signing.submit', $token) }}">
            @csrf
            <h3>Your Signature</h3>

            <div class="form-group">
                <label for="signer_full_name">Full Legal Name</label>
                <input type="text" id="signer_full_name" name="signer_full_name" value="{{ $signingRequest->recipient_name }}" required>
            </div>

            <p class="form-group" style="font-size: 14px; font-weight: 500; color: #374151;">Draw your signature below</p>
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
                By signing below, I confirm that I have read and agree to the terms of this document.
                I consent to signing this document electronically in accordance with the
                Electronic Transactions Act 1999 (Cth).
            </p>

            <button type="submit" class="submit-btn" id="submit-btn" disabled>Sign Document</button>
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
