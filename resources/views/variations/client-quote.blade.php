<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Quote - {{ $variation->co_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; font-size: 14px; line-height: 1.5; }

        .page { max-width: 800px; margin: 0 auto; padding: 40px; }

        @media print {
            .page { padding: 20px; max-width: none; }
            .no-print { display: none !important; }
            @page { margin: 1.5cm; }
        }

        .header { border-bottom: 3px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .header-left img { max-width: 120px; height: auto; }
        .header h1 { font-size: 24px; font-weight: 700; color: #0f172a; }
        .co-badge { font-size: 22px; font-weight: 700; color: #0f172a; border: 2px solid #1e293b; padding: 4px 16px; border-radius: 4px; }

        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
        .detail-item { }
        .detail-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px; }
        .detail-value { font-size: 14px; font-weight: 500; color: #1e293b; }

        .description-section { margin-bottom: 24px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
        .description-section .detail-label { margin-bottom: 6px; }
        .description-section .detail-value { font-size: 13px; color: #334155; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f5f9; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        th.right { text-align: right; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        td.right { text-align: right; font-variant-numeric: tabular-nums; }
        td.bold { font-weight: 600; }

        .totals { border-top: 2px solid #1e293b; padding-top: 16px; margin-top: 4px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .totals-row.grand { font-size: 18px; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 8px; }

        .notes { margin-top: 30px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
        .notes-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; }
        .notes-text { font-size: 13px; color: #475569; white-space: pre-wrap; }

        .footer-warning { margin-top: 30px; text-align: center; font-size: 12px; color: #dc2626; font-weight: 600; font-style: italic; }
        .footer { margin-top: 12px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }

        .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #1e293b; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; }
        .print-btn:hover { background: #334155; }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">Print Quote</button>

    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="{{ asset('logo.png') }}" alt="Logo">
                <h1>VARIATION</h1>
            </div>
            <div class="co-badge">{{ $variation->co_number }}</div>
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
                <div class="detail-label">Type</div>
                <div class="detail-value">{{ ucfirst($variation->type) }}</div>
            </div>
        </div>

        <div class="description-section">
            <div class="detail-label">Description of Works</div>
            <div class="detail-value">{{ $variation->description ?? '—' }}</div>
        </div>

        @if($variation->pricingItems->count() > 0)
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
                @php
                    $totalSell = 0;
                    $uomM2Ids = $uomM2Ids ?? [];
                @endphp
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

        <div class="totals">
            <div class="totals-row">
                <span>Sub Total</span>
                <span>${{ number_format($totalSell, 2) }}</span>
            </div>
            <div class="totals-row grand">
                <span>Total (excl. GST)</span>
                <span>${{ number_format($totalSell, 2) }}</span>
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
