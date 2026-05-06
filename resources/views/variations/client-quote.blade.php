<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Quote - {{ $variation->co_number }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    {{-- Instrument Sans — same family the app uses (set in resources/css/app.css). --}}
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            /* Compact-industrial palette — neutral gray with slightly more contrast. */
            --ink-strong: #0c0a09;
            --ink: #1c1917;
            --ink-soft: #292524;
            --muted: #44403c;
            --muted-soft: #57534e;
            --faint: #78716c;
            --rule: #d6d3d1;
            --rule-soft: #e7e5e4;
            --rule-faint: #f5f5f4;
            --surface: #fafaf9;

            /* Compact type scale — body sits at 12px (text-xs) per spec. */
            --text-meta: 0.5625rem;     /*  9px — micro labels, document IDs */
            --text-eyebrow: 0.625rem;   /* 10px — uppercase labels, footer */
            --text-body: 0.75rem;       /* 12px — body content */
            --text-emph: 0.8125rem;     /* 13px — totals row, emphasis */
            --text-grand: 0.9375rem;    /* 15px — grand total only */
            --text-display: 1rem;       /* 16px — CO number */

            /* One font family throughout — matches the app's --font-sans token. */
            --sans: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
        }

        body {
            font-family: var(--sans);
            color: var(--ink-soft);
            font-size: var(--text-body);
            line-height: 1.45;
            background: var(--surface);
            font-feature-settings: 'kern', 'liga', 'calt';
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .page {
            max-width: 760px;
            margin: 0 auto;
            padding: 28px 32px;
            background: #ffffff;
            border: 1px solid var(--rule-soft);
        }

        @media print {
            body { background: #ffffff; }
            .page { padding: 16px 20px; max-width: none; border: 0; }
            .no-print { display: none !important; }
            @page { margin: 1.4cm; }
        }

        /* ── Header ── */
        .header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            padding-bottom: 12px;
            margin-bottom: 18px;
            border-bottom: 1px solid var(--ink);
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .header-left img { max-width: 96px; height: auto; }
        .header h1 {
            font-size: var(--text-emph);
            font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.005em;
        }
        .header-meta {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
        }
        .co-badge {
            font-size: var(--text-display);
            font-weight: 600;
            color: var(--ink-strong);
            font-variant-numeric: tabular-nums lining-nums;
            line-height: 1;
            padding: 6px 12px;
            border: 1px solid var(--ink);
            border-radius: 4px;
        }

        /* ── Detail grid ── */
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 24px;
            margin-bottom: 18px;
            padding: 10px 0;
            border-top: 1px solid var(--rule-soft);
            border-bottom: 1px solid var(--rule-soft);
        }
        .detail-item { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
        .detail-label {
            font-size: var(--text-body);
            font-weight: 500;
            color: var(--faint);
            min-width: 96px;
        }
        .detail-value {
            font-size: var(--text-body);
            font-weight: 400;
            color: var(--ink-soft);
            font-variant-numeric: tabular-nums;
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* ── Description block ── */
        .description-section {
            margin-bottom: 18px;
            padding: 10px 12px;
            background: #ffffff;
            border-left: 2px solid var(--ink);
        }
        .description-section .detail-label {
            font-size: var(--text-body);
            min-width: 0;
            margin-bottom: 4px;
        }
        .description-section .detail-value {
            font-size: var(--text-body);
            color: var(--ink-soft);
            line-height: 1.5;
            white-space: normal;
            max-width: 70ch;
        }

        /* ── Section heading (Direct Material) ── */
        h3 {
            font-size: var(--text-emph);
            font-weight: 600;
            color: var(--ink);
            margin-top: 16px;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--rule-soft);
        }

        /* ── Tables ── */
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th {
            background: transparent;
            font-size: var(--text-body);
            font-weight: 500;
            color: var(--muted-soft);
            padding: 6px 8px;
            text-align: left;
            border-bottom: 1px solid var(--ink);
        }
        th.right { text-align: right; }
        td {
            padding: 6px 8px;
            border-bottom: 1px solid var(--rule-faint);
            font-size: var(--text-body);
            color: var(--ink-soft);
            line-height: 1.4;
        }
        td.right {
            text-align: right;
            font-variant-numeric: tabular-nums lining-nums;
        }
        td.bold { font-weight: 600; color: var(--ink); }
        tbody tr:last-child td { border-bottom: 1px solid var(--ink); }

        /* ── Totals ── */
        .totals {
            margin-top: 4px;
            padding: 10px 0 0;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: var(--text-body);
            color: var(--muted-soft);
        }
        .totals-row > span:last-child {
            font-variant-numeric: tabular-nums lining-nums;
            color: var(--ink-soft);
        }
        .totals-row.grand {
            font-size: var(--text-grand);
            font-weight: 600;
            color: var(--ink-strong);
            border-top: 1px solid var(--ink);
            padding-top: 8px;
            margin-top: 4px;
        }
        .totals-row.grand > span:first-child {
            font-size: var(--text-emph);
            font-weight: 500;
            color: var(--ink);
        }
        .totals-row.grand > span:last-child { color: var(--ink-strong); font-weight: 600; }

        /* ── Notes ── */
        .notes {
            margin-top: 20px;
            padding: 10px 12px;
            background: #ffffff;
            border-left: 2px solid var(--rule);
        }
        .notes-label {
            font-size: var(--text-body);
            font-weight: 500;
            color: var(--faint);
            margin-bottom: 4px;
        }
        .notes-text {
            font-size: var(--text-body);
            color: var(--ink-soft);
            white-space: pre-wrap;
            line-height: 1.5;
            max-width: 70ch;
        }

        /* ── Footer ── */
        .footer-warning {
            margin-top: 22px;
            padding: 8px 10px;
            text-align: center;
            font-size: var(--text-body);
            color: var(--muted-soft);
            font-weight: 500;
            border-top: 1px dashed var(--rule);
            border-bottom: 1px dashed var(--rule);
        }
        .footer {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--rule-faint);
            font-size: var(--text-meta);
            color: var(--faint);
            text-align: center;
            font-variant-numeric: tabular-nums;
        }

        /* ── Print button ── */
        .print-btn {
            position: fixed;
            top: 16px;
            right: 16px;
            padding: 7px 14px;
            background: var(--ink-strong);
            color: #ffffff;
            border: 1px solid var(--ink-strong);
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--sans);
            font-size: var(--text-body);
            font-weight: 500;
            transition: background 150ms ease, border-color 150ms ease;
        }
        .print-btn:hover { background: var(--ink); border-color: var(--ink); }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">Print Quote</button>

    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="{{ asset('logo.png') }}" alt="Logo">
                <h1>Variation</h1>
            </div>
            <div class="header-meta">
                <span class="co-badge">{{ $variation->co_number }}</span>
            </div>
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Project</div>
                <div class="detail-value">{{ $variation->location->name ?? 'N/A' }}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date</div>
                <div class="detail-value">{{ $variation->co_date ? \Carbon\Carbon::parse($variation->co_date)->format('d/m/Y') : now()->format('d/m/Y') }}</div>
            </div>
            @if($variation->location && $variation->location->external_id)
            <div class="detail-item">
                <div class="detail-label">Job Number</div>
                <div class="detail-value">{{ $variation->location->external_id }}</div>
            </div>
            @endif
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value">{{ strtoupper($variation->status ?? 'PENDING') }}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Issued By</div>
                <div class="detail-value">{{ $variation->created_by ?? '—' }}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Effect on Duration of Program</div>
                <div class="detail-value">
                    @php $days = (int) ($variation->extra_days ?? 0); @endphp
                    {{ $days === 0 ? 'No effect' : ($days . ' day' . ($days === 1 ? '' : 's')) }}
                </div>
            </div>
        </div>

        <div class="description-section">
            <div class="detail-label">Description of Works</div>
            <div class="detail-value">{{ $variation->description ?? '—' }}</div>
        </div>

        @php
            $uomM2Ids = $uomM2Ids ?? [];
            $hasPricing = $variation->pricingItems->count() > 0;
            $hasDirectMaterial = $variation->directMaterials->count() > 0;
            $totalSell = 0;
            $directMaterialTotal = 0;
        @endphp

        @if($hasPricing)
        <table>
            <thead>
                <tr>
                    <th>Material / Rates</th>
                    <th class="right">Unit</th>
                    <th class="right">Qty</th>
                    <th class="right">Rate</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($variation->pricingItems as $item)
                @php
                    $sellRate = $item->sell_rate ?? 0;
                    $displayQty = $item->qty;
                    $displayUnit = $item->unit;
                    $displayRate = $sellRate;

                    $condition = $item->condition;
                    $showAsM2 = in_array($item->id, $uomM2Ids)
                        && $condition
                        && $condition->type === 'linear'
                        && $condition->height
                        && $condition->height > 0;

                    if ($showAsM2) {
                        $height = $condition->height;
                        $displayQty = $item->qty * $height;
                        $displayUnit = 'm2';
                        $displayRate = $sellRate > 0 ? $sellRate / $height : 0;
                    }

                    $sellTotal = $displayQty * $displayRate;
                    $totalSell += $sellTotal;
                @endphp
                <tr>
                    <td>{{ $item->description }}</td>
                    <td class="right">{{ $displayUnit }}</td>
                    <td class="right">{{ number_format($displayQty, 2) }}</td>
                    <td class="right">${{ number_format($displayRate, 2) }}</td>
                    <td class="right bold">${{ number_format($sellTotal, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif

        @if($hasDirectMaterial)
        <h3>Direct Material</h3>
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="right">Qty</th>
                    <th class="right">Cost</th>
                    <th class="right">Markup</th>
                    <th class="right">Rate</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($variation->directMaterials as $dm)
                @php
                    // "Cost" shown to the client is the per-unit sell — unit cost
                    // grossed up by the per-row sell markup. The true unit cost
                    // stays hidden.
                    $perUnitSell = (float) $dm->unit_cost * (1 + ((float) $dm->sell_markup_pct) / 100);
                    $clientMarkupPct = (float) $dm->client_markup_pct;
                    // Final per-unit rate adds the client markup on top.
                    $clientUnitRate = $perUnitSell * (1 + $clientMarkupPct / 100);
                    $lineTotal = (float) $dm->qty * $clientUnitRate;
                    $directMaterialTotal += $lineTotal;
                    $itemLabel = trim(
                        ($dm->material_code ? $dm->material_code . ' — ' : '')
                        . ($dm->material_description ?: ($dm->description ?? ''))
                    );
                    if ($itemLabel === '') $itemLabel = 'Material';
                @endphp
                <tr>
                    <td>{{ $itemLabel }}</td>
                    <td class="right">{{ number_format((float) $dm->qty, 2) }}</td>
                    <td class="right">${{ number_format($perUnitSell, 2) }}</td>
                    <td class="right">{{ number_format($clientMarkupPct, 2) }}%</td>
                    <td class="right">${{ number_format($clientUnitRate, 2) }}</td>
                    <td class="right bold">${{ number_format($lineTotal, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @endif

        @if($hasPricing || $hasDirectMaterial)
        @php $grandTotal = $totalSell + $directMaterialTotal; @endphp
        <div class="totals">
            @if($hasPricing && $hasDirectMaterial)
            <div class="totals-row">
                <span>Items</span>
                <span>${{ number_format($totalSell, 2) }}</span>
            </div>
            <div class="totals-row">
                <span>Direct Material</span>
                <span>${{ number_format($directMaterialTotal, 2) }}</span>
            </div>
            @else
            <div class="totals-row">
                <span>Sub Total</span>
                <span>${{ number_format($grandTotal, 2) }}</span>
            </div>
            @endif
            <div class="totals-row grand">
                <span>Total (excl. GST)</span>
                <span>${{ number_format($grandTotal, 2) }}</span>
            </div>
        </div>
        @else
        <p style="color: #94a3b8; text-align: center; padding: 40px;">No pricing items have been added to this variation.</p>
        @endif

        @if($variation->client_notes)
        <div class="notes">
            <div class="notes-label">Notes</div>
            <div class="notes-text">{{ $variation->client_notes }}</div>
        </div>
        @endif

        <div class="footer-warning">
            Note: Works will not proceed without written approval from an authorised representative
        </div>

        <div class="footer">
            Generated {{ now()->format('d M Y H:i') }}
        </div>
    </div>
</body>
</html>
