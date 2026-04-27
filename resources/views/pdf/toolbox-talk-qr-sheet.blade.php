@php
    use Carbon\Carbon;
    use Endroid\QrCode\Builder\Builder;
    use Endroid\QrCode\Writer\PngWriter;

    $qrPng = (new Builder(
        writer: new PngWriter(),
        data: $signInUrl,
        size: 560,
        margin: 8,
    ))->build();
    $qrDataUri = $qrPng->getDataUri();

    $logoPath = public_path('logo.png');
    $logoDataUri = file_exists($logoPath)
        ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
        : null;

    $location = $talk->location;
    $subjectLabel = \App\Models\ToolboxTalk::SUBJECT_OPTIONS[$talk->meeting_subject] ?? $talk->meeting_subject;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Toolbox Talk Sign-In QR — {{ Carbon::parse($talk->meeting_date)->format('d/m/Y') }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #0f172a;
            background: #fff;
        }
        .page {
            padding: 40px 56px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        .logo {
            height: 64px;
            margin-bottom: 24px;
        }
        .logo img { height: 64px; width: auto; display: block; }
        .eyebrow {
            text-transform: uppercase;
            letter-spacing: 2px;
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
        }
        h1 {
            font-size: 36px;
            font-weight: 700;
            margin: 12px 0 8px;
            letter-spacing: -0.02em;
        }
        .meta {
            color: #475569;
            font-size: 14px;
            margin-bottom: 32px;
        }
        .meta strong { color: #0f172a; font-weight: 600; }
        .qr-card {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 32px;
            background: #fff;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .qr-card img {
            width: 360px;
            height: 360px;
            display: block;
        }
        .url {
            margin-top: 24px;
            font-size: 13px;
            color: #475569;
            word-break: break-all;
            max-width: 480px;
        }
        .url strong { color: #0f172a; }
        .steps {
            margin-top: 32px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            max-width: 640px;
            width: 100%;
        }
        .step {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            text-align: left;
        }
        .step .num {
            display: inline-flex;
            width: 24px; height: 24px;
            border-radius: 999px;
            background: #0f172a;
            color: #fff;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .step .title { font-weight: 600; font-size: 13px; }
        .step .body { font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.4; }
        footer {
            margin-top: 32px;
            font-size: 11px;
            color: #94a3b8;
        }
    </style>
</head>
<body>
<div class="page">
    @if($logoDataUri)
        <div class="logo"><img src="{{ $logoDataUri }}" alt="Superior Group" /></div>
    @endif
    <div class="eyebrow">Toolbox Talk · Sign-In</div>
    <h1>Scan to sign in</h1>
    <p class="meta">
        <strong>{{ Carbon::parse($talk->meeting_date)->format('l, d M Y') }}</strong>
        @if($location) · {{ $location->name }} @endif
        · {{ $subjectLabel }}
    </p>

    <div class="qr-card">
        <img src="{{ $qrDataUri }}" alt="QR code" />
    </div>

    <div class="url">
        Or open: <strong>{{ $signInUrl }}</strong>
    </div>

    <div class="steps">
        <div class="step">
            <div class="num">1</div>
            <div class="title">Scan with your phone</div>
            <div class="body">Use your camera app — no install needed.</div>
        </div>
        <div class="step">
            <div class="num">2</div>
            <div class="title">Find your name &amp; enter PIN</div>
            <div class="body">Same 4-digit PIN you use at the kiosk.</div>
        </div>
        <div class="step">
            <div class="num">3</div>
            <div class="title">Acknowledge &amp; sign</div>
            <div class="body">Tick the points and sign with your finger.</div>
        </div>
    </div>

    <footer>
        @if($location) {{ $location->name }} ·@endif Posted {{ now('Australia/Brisbane')->format('d/m/Y H:i') }}
    </footer>
</div>
</body>
</html>
