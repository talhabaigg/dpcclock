<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @php
        $documentLabel = $signingRequest->documentTemplate?->name
            ?? $signingRequest->document_title
            ?? 'Document';

        $cmsEntityId = (int) config('services.employment_hero.cms_entity_id');
        $signable = $signingRequest->signable;
        $isCms = $signable instanceof \App\Models\Employee && (int) $signable->employing_entity_id === $cmsEntityId;
        $logoPath = $isCms ? 'logo-cms.png' : 'logo.png';

        $user = auth()->user();
    @endphp
    <title>Sign {{ $documentLabel }}</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; line-height: 1.6; }
        .container { max-width: 720px; margin: 0 auto; padding: 20px 16px; }
        .header { text-align: center; padding: 24px 0 20px; }
        .header img { max-height: 60px; max-width: 220px; width: auto; height: auto; object-fit: contain; margin-bottom: 12px; }
        .header h1 { font-size: 20px; font-weight: 600; color: #0f172a; }
        .header p { font-size: 14px; color: #64748b; margin-top: 2px; }
        .info-banner { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; font-size: 14px; color: #1e40af; }
        .agreement-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
        .agreement-header { padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; }
        .agreement-header h2 { font-size: 14px; font-weight: 600; color: #334155; }
        .agreement-body { padding: 24px 28px; max-height: 65vh; overflow-y: auto; scroll-behavior: smooth; }
        .agreement-body h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 24px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
        .agreement-body h1:first-child { margin-top: 0; }
        .agreement-body h2 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 20px 0 6px; }
        .agreement-body h3 { font-size: 14px; font-weight: 600; color: #334155; margin: 16px 0 4px; }
        .agreement-body p { font-size: 14px; line-height: 1.7; color: #374151; margin: 4px 0 8px; }
        .agreement-body strong { font-weight: 600; color: #1e293b; }
        .agreement-body .signature-placeholder { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; color: #94a3b8; margin: 16px 0; font-style: italic; font-size: 13px; background: #f8fafc; }
        .signature-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        .signature-section h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
        .form-group input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .canvas-wrapper { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; background: #fff; margin-bottom: 8px; }
        .canvas-wrapper canvas { width: 100%; display: block; }
        .canvas-actions { display: flex; gap: 8px; margin-bottom: 12px; }
        .canvas-actions button { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; font-size: 12px; cursor: pointer; }
        .save-sig-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; margin-bottom: 16px; cursor: pointer; }
        .submit-btn { width: 100%; padding: 14px; background: #1e3a5f; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-msg { color: #dc2626; font-size: 12px; display: none; margin-top: 4px; }
        @media (max-width: 600px) {
            .agreement-body { padding: 16px; max-height: 55vh; }
            .form-row { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset($logoPath) }}" alt="{{ $isCms ? 'CMS' : 'DPC' }}">
            <h1>{{ $documentLabel }}</h1>
            <p>Internal signature required</p>
        </div>

        <div class="info-banner">
            <strong>{{ $signingRequest->sentBy?->name ?? 'A colleague' }}</strong> has requested your signature on this document before it is sent to <strong>{{ $signingRequest->recipient_name }}</strong>.
        </div>

        <div class="agreement-card">
            <div class="agreement-header">
                <h2>{{ $documentLabel }}</h2>
            </div>
            <div class="agreement-body">
                {!! $displayHtml !!}
            </div>
        </div>

        <form id="signing-form" class="signature-section" method="POST" action="{{ route('internal-sign.submit', $token) }}">
            @csrf
            <h3>Your Signature</h3>

            <div class="form-row">
                <div class="form-group">
                    <label for="signer_full_name">Full Name</label>
                    <input type="text" id="signer_full_name" name="signer_full_name" value="{{ $user->name }}" required>
                </div>
                <div class="form-group">
                    <label for="signer_position">Position <span style="color: #94a3b8;">(optional)</span></label>
                    <input type="text" id="signer_position" name="signer_position" value="{{ $user->position ?? '' }}">
                </div>
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

            @if(!$user->hasSavedSignature())
            <label class="save-sig-label">
                <input type="checkbox" name="save_signature" value="1">
                Save this signature for future use
            </label>
            @endif

            <input type="hidden" name="signature_data" id="signature-data">

            <button type="submit" class="submit-btn" id="submit-btn">Sign & Send to Recipient</button>
        </form>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function () {
            const canvas = document.getElementById('signature-canvas');
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d').scale(ratio, ratio);

            const signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });

            document.getElementById('clear-btn').addEventListener('click', () => signaturePad.clear());
            document.getElementById('undo-btn').addEventListener('click', () => {
                const data = signaturePad.toData();
                if (data.length > 0) { data.pop(); signaturePad.fromData(data); }
            });

            document.getElementById('signing-form').addEventListener('submit', function (e) {
                const errorEl = document.getElementById('signature-error');
                if (signaturePad.isEmpty()) {
                    e.preventDefault();
                    errorEl.style.display = 'block';
                    return;
                }
                errorEl.style.display = 'none';
                document.getElementById('signature-data').value = signaturePad.toDataURL('image/png');
            });
        });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
</body>
</html>
