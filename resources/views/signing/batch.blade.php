<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    @php
        $allDone = $pendingCount === 0 && $signedCount > 0;
        $totalCount = $requests->count();
    @endphp
    <title>{{ $allDone ? 'All signed' : 'Documents from '.$senderName }}</title>
    <link rel="icon" type="image/x-icon" href="{{ asset('favicon.ico') }}">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; color: #1e293b; min-height: 100vh; line-height: 1.6; }
        .container { max-width: 560px; margin: 0 auto; padding: 20px 16px; }

        /* Header with logo */
        .header { text-align: center; padding: 24px 0 20px; }
        .header img { max-height: 60px; max-width: 220px; width: auto; height: auto; object-fit: contain; margin-bottom: 14px; }
        .header .sender { font-size: 13px; color: #64748b; }
        .header .sender strong { color: #0f172a; font-weight: 600; }

        .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
        .lead { font-size: 15px; color: #334155; margin-bottom: 18px; line-height: 1.55; }
        .lead strong { color: #0f172a; }

        ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        li { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fff; }
        li.signed { background: #fafafa; }
        .doc-title { font-size: 15px; font-weight: 500; color: #0f172a; }
        .doc-meta { font-size: 12px; color: #64748b; margin-top: 4px; }
        .pill { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
        .pill.done { background: #ecfdf5; color: #047857; border: 1px solid #bbf7d0; }
        a.btn { background: #2563eb; color: #fff; text-decoration: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; white-space: nowrap; transition: background 0.15s; }
        a.btn:hover { background: #1d4ed8; }
        a.btn.muted { background: #f1f5f9; color: #475569; }
        a.btn.muted:hover { background: #e2e8f0; }

        /* All-done celebration */
        .done-card { text-align: center; padding: 12px 4px 8px; }
        .done-icon { width: 56px; height: 56px; border-radius: 50%; background: #ecfdf5; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .done-icon svg { width: 30px; height: 30px; color: #059669; }
        .done-card h2 { font-size: 19px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }
        .done-card p { font-size: 14px; color: #64748b; }

        .footer { text-align: center; padding: 20px 8px 12px; font-size: 12px; color: #94a3b8; line-height: 1.6; }
        .empty { text-align: center; padding: 32px 12px; color: #64748b; font-size: 14px; }

        @media (max-width: 640px) {
            .container { padding: 12px; }
            .card { padding: 18px; }
            li { padding: 12px 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset($logoPath) }}" alt="{{ $brandLabel }}">
        </div>

        <div class="card">
            @if ($requests->isEmpty())
                <div class="empty">No documents available on this link.</div>
            @elseif ($allDone)
                <div class="done-card">
                    <div class="done-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </div>
                    <h2>All done — thanks, {{ $recipientName }}!</h2>
                    <p>You've signed every document {{ $senderName }} sent you.</p>
                </div>
                <ul style="margin-top: 20px;">
                    @foreach ($requests as $sr)
                        @php $label = $sr->documentTemplate?->name ?? $sr->document_title ?? 'Document'; @endphp
                        <li class="signed">
                            <div>
                                <div class="doc-title">{{ $label }}</div>
                                <div class="doc-meta"><span class="pill done">Signed</span></div>
                            </div>
                            <a class="btn muted" href="{{ url('/sign/'.$sr->token.'/thank-you') }}">View</a>
                        </li>
                    @endforeach
                </ul>
            @else
                <p class="lead">
                    Hi <strong>{{ $recipientName }}</strong>, {{ $senderName }} sent you
                    <strong>{{ $pendingCount }} document{{ $pendingCount === 1 ? '' : 's' }}</strong> to sign.
                    @if ($signedCount > 0)
                        <span style="color:#94a3b8;">({{ $signedCount }} of {{ $totalCount }} already done)</span>
                    @endif
                </p>
                <ul>
                    @foreach ($requests as $sr)
                        @php
                            $label = $sr->documentTemplate?->name ?? $sr->document_title ?? 'Document';
                            $isSigned = $sr->status === 'signed';
                        @endphp
                        <li class="{{ $isSigned ? 'signed' : '' }}">
                            <div>
                                <div class="doc-title">{{ $label }}</div>
                                @if ($isSigned)
                                    <div class="doc-meta"><span class="pill done">Signed</span></div>
                                @endif
                            </div>
                            @if ($isSigned)
                                <a class="btn muted" href="{{ url('/sign/'.$sr->token.'/thank-you') }}">View</a>
                            @else
                                <a class="btn" href="{{ url('/sign/'.$sr->token) }}">Review &amp; Sign</a>
                            @endif
                        </li>
                    @endforeach
                </ul>
            @endif
        </div>

        <p class="footer">
            Questions? Contact {{ $senderName }} directly.<br>
            Links expire 7 days from the day they were sent.
        </p>
    </div>
</body>
</html>
