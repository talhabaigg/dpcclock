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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; }
        .container { max-width: 900px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
        .header h1 { font-size: 20px; font-weight: 600; color: #0f172a; }
        .header p { font-size: 14px; color: #64748b; margin-top: 4px; }

        .greeting { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 15px; }

        /* PDF pages */
        .pdf-loading { text-align: center; padding: 40px; color: #64748b; font-size: 15px; }

        /* Paginated page viewer */
        .page-viewer { margin-bottom: 24px; }
        .page-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #334155; color: #fff; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 500; }
        .page-canvas-wrapper { background: #fff; border: 1px solid #cbd5e1; border-top: none; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .page-canvas-wrapper canvas { display: block; width: 100%; height: auto; }

        /* Initials section below current page */
        .initials-section { background: #fefce8; border: 1px solid #fde68a; border-top: none; border-radius: 0 0 8px 8px; padding: 12px 16px; }
        .initials-section h4 { font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 8px; }
        .initials-row { display: flex; align-items: center; gap: 12px; }
        .initials-canvas-wrapper { border: 1px solid #d1d5db; border-radius: 6px; background: #fff; flex-shrink: 0; touch-action: none; }
        .initials-canvas-wrapper canvas { display: block; border-radius: 5px; }
        .initials-status { font-size: 12px; color: #64748b; }
        .initials-status.done { color: #16a34a; font-weight: 600; }
        .initials-actions { display: flex; gap: 6px; }
        .initials-actions button { padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; font-size: 11px; cursor: pointer; color: #374151; }
        .initials-actions button:hover { background: #f3f4f6; }

        /* Page navigation */
        .page-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; gap: 12px; }
        .page-nav-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; font-size: 14px; font-weight: 500; cursor: pointer; color: #374151; transition: all 0.15s; }
        .page-nav-btn:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
        .page-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-nav-btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
        .page-nav-btn.primary:hover:not(:disabled) { background: #1d4ed8; }
        .page-nav-info { font-size: 13px; color: #64748b; font-weight: 500; }

        /* Progress dots */
        .page-dots { display: flex; justify-content: center; gap: 6px; margin-top: 12px; }
        .page-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #d1d5db; background: #fff; transition: all 0.15s; cursor: pointer; }
        .page-dot.active { border-color: #2563eb; background: #2563eb; }
        .page-dot.initialed { border-color: #16a34a; background: #16a34a; }
        .page-dot.initialed.active { border-color: #2563eb; box-shadow: 0 0 0 2px #2563eb; }

        /* Read confirmation */
        .read-confirmation { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; display: none; }
        .read-confirmation.visible { display: block; }
        .read-confirmation label { display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 15px; font-weight: 500; }
        .read-confirmation input[type="checkbox"] { width: 20px; height: 20px; accent-color: #2563eb; }

        /* Signature section */
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
            Hi <strong>{{ $signingRequest->recipient_name }}</strong>, please review each page of the document below, initial each page, then provide your signature at the end.
        </div>

        <!-- Single page viewer -->
        <div id="pdf-pages">
            <div class="pdf-loading" id="pdf-loading">Loading document...</div>
        </div>

        <div class="read-confirmation" id="read-confirmation">
            <label>
                <input type="checkbox" id="read-checkbox">
                I have read and understood this document and initialed every page
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
            <p id="initials-error" class="error-msg">Please initial every page before submitting.</p>

            <input type="hidden" name="signature_data" id="signature-data">
            <input type="hidden" name="initials_data" id="initials-data">

            <p class="consent-text">
                By signing below, I confirm that I have read, initialed each page, and agree to the terms of this document.
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
        window.__preview_pdf_url = @json(route('signing.preview-pdf', $token));
    </script>
</body>
</html>
