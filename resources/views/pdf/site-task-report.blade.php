<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #374151; }
    h1 { font-size: 18px; color: #1f2937; }
    h2 { font-size: 15px; color: #1f2937; border-bottom: 2px solid #374151; padding-bottom: 4px; margin-bottom: 10px; }
    h3 { font-size: 11px; color: #1f2937; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 14px 0 6px; text-transform: none; }
    .page-break { page-break-before: always; }
    .muted { color: #6b7280; }

    /* Cover */
    .cover-head { display: flex; align-items: flex-start; border-bottom: 3px solid #1f2937; padding-bottom: 8px; margin-bottom: 14px; }
    .cover-head .proj { font-size: 16px; font-weight: 700; color: #1f2937; }
    .report-title { font-size: 17px; font-weight: 800; letter-spacing: 0.3px; color: #1f2937; text-transform: uppercase; border-bottom: 3px solid #374151; display: inline-block; padding-bottom: 3px; margin-bottom: 10px; }
    .meta-line { font-size: 10px; margin-bottom: 3px; }
    .cover-list { font-size: 10px; margin-bottom: 4px; }

    /* TOC */
    table.toc { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    table.toc th { text-align: left; font-size: 9px; color: #374151; font-weight: 400; border-bottom: 1px solid #9ca3af; padding: 3px 4px; }
    table.toc td { font-size: 9px; border-bottom: 1px solid #e5e7eb; padding: 6px 4px; vertical-align: top; }
    table.toc td.num { font-weight: 700; }

    /* Task blocks */
    .task { border-top: 1px solid #d1d5db; padding: 10px 0 12px; page-break-inside: avoid; }
    .task-row { display: flex; gap: 12px; }
    .task-main { flex: 1; min-width: 0; }
    .task-title { font-size: 12px; font-weight: 800; color: #374151; margin-bottom: 3px; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
    .task-meta { font-size: 9px; color: #4b5563; margin-bottom: 2px; }
    .plan-crop { width: 220px; height: 132px; position: relative; overflow: hidden; border: 1px solid #d1d5db; flex-shrink: 0; background: #fff; }
    .plan-crop img { position: absolute; max-width: none; }
    .plan-crop .pin { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; border-radius: 50% 50% 50% 0; transform: translate(-50%, -100%) rotate(-45deg); border: 1.5px solid #fff; }
    .messages-label { font-size: 9px; font-weight: 700; color: #374151; margin: 8px 0 4px; }
    .message { display: flex; gap: 10px; margin-bottom: 8px; }
    .message .author { width: 110px; flex-shrink: 0; font-size: 9px; }
    .message .content { flex: 1; }
    .message .when { width: 90px; flex-shrink: 0; text-align: right; font-size: 9px; color: #6b7280; }
    .message img { max-height: 170px; max-width: 240px; border: 1px solid #e5e7eb; border-radius: 2px; display: block; margin-bottom: 4px; }

    /* Final sheets */
    .sheet-wrap { position: relative; display: inline-block; max-width: 100%; }
    .sheet-wrap img { max-width: 100%; max-height: 240mm; display: block; }
    .sheet-pin { position: absolute; transform: translate(-50%, -100%); text-align: center; }
    .sheet-pin .dot { width: 11px; height: 11px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 1.5px solid #fff; margin: 0 auto; }
    .sheet-pin .lbl { font-size: 6px; font-weight: 700; color: #b91c1c; background: rgba(255,255,255,0.85); border-radius: 2px; padding: 0 1px; }
</style>
</head>
<body>

{{-- ── Cover ─────────────────────────────────────────────── --}}
<div class="cover-head">
    <div style="flex:1;">
        <div class="proj">{{ $project->name }}</div>
        @if ($project->state)
            <div class="muted" style="font-size:11px;">{{ $project->state }}</div>
        @endif
    </div>
    @if ($logoData)
        <img src="{{ $logoData }}" alt="Company logo" style="height: 46px;">
    @endif
</div>

<div class="report-title">{{ strtoupper($title) }}</div>

<div class="meta-line">Created: {{ $createdAt->format('d-m-Y') }}</div>
@if ($creator)
    <div class="meta-line">Creator: {{ $creator }}</div>
@endif
<div class="meta-line">Status: {{ $statuses->map(fn ($s) => ucwords(str_replace('_', ' ', $s)))->implode(', ') }}</div>
@if ($dateFrom && $dateTo)
    <div class="meta-line">Dates: {{ $dateFrom->format('d-m-Y') }} - {{ $dateTo->format('d-m-Y') }}</div>
@endif

@if ($sheetList->isNotEmpty())
    <h3>Sheets</h3>
    @foreach ($sheetList as $sheet)
        <div class="cover-list">{{ $sheet }}</div>
    @endforeach
@endif

<h3>Categories</h3>
@foreach ($groups as $group)
    <div class="cover-list">{{ $group['name'] }}@if ($group['code']) ({{ $group['code'] }}) @endif</div>
@endforeach

@if ($users->isNotEmpty())
    <h3>Users</h3>
    @foreach ($users as $user)
        <div class="cover-list">{{ $user }}</div>
    @endforeach
@endif

{{-- ── Table of contents ─────────────────────────────────── --}}
<div class="page-break"></div>
<h2>Table of contents</h2>
@foreach ($groups as $group)
    <div style="font-weight:700; font-size:11px; margin:10px 0 4px;">{{ $group['name'] }}</div>
    <table class="toc">
        <thead>
            <tr>
                <th style="width:36px;">#</th>
                <th>Description</th>
                <th style="width:110px;">Plan</th>
                <th style="width:110px;">Assignee</th>
                <th style="width:110px;">Status</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($group['tasks'] as $task)
                <tr>
                    <td class="num">{{ $task['id'] }}</td>
                    <td>{{ $task['title'] }}</td>
                    <td class="muted">{{ $task['plan_label'] }}</td>
                    <td class="muted">{{ $task['assignees']->implode(', ') }}</td>
                    <td class="muted">{{ ucwords(str_replace('_', ' ', $task['status'])) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endforeach

{{-- ── Task sections, grouped by category ────────────────── --}}
@php
    $statusColors = [
        'open' => '#3b82f6',
        'in_progress' => '#eab308',
        'completed' => '#22c55e',
        'closed' => '#9ca3af',
        'cancelled' => '#9ca3af',
    ];
@endphp
@foreach ($groups as $group)
    <div class="page-break"></div>
    <h2>{{ $group['name'] }}</h2>

    @foreach ($group['tasks'] as $task)
        <div class="task">
            <div class="task-row">
                <div class="task-main">
                    <div class="task-title">
                        <span class="status-dot" style="background: {{ $statusColors[$task['status']] ?? '#9ca3af' }};"></span>
                        #{{ $task['id'] }} - {{ $task['title'] }}
                    </div>
                    <div class="task-meta">
                        {{ ucwords(str_replace('_', ' ', $task['status'])) }}
                        @if ($task['assignees']->isNotEmpty()) &nbsp;|&nbsp; {{ $task['assignees']->implode(', ') }} @endif
                        @if ($task['category']) &nbsp;|&nbsp; {{ $task['category'] }} @endif
                    </div>
                    @if ($task['plan_label'])
                        <div class="task-meta">Plan: {{ $task['plan_label'] }}</div>
                    @endif
                    <div class="task-meta muted">Created {{ $task['created_at']->format('d-m-Y') }}</div>
                    @if ($task['checklist'])
                        <div class="task-meta muted">{{ $task['checklist'] }}</div>
                    @endif
                    @if ($task['description'])
                        <div class="task-meta" style="margin-top:4px;">{{ $task['description'] }}</div>
                    @endif
                </div>

                @if ($task['plan_image'] && $task['pin'])
                    <div class="plan-crop" data-x="{{ $task['pin']['x'] }}" data-y="{{ $task['pin']['y'] }}" data-zoom="3.2">
                        <img src="{{ $task['plan_image'] }}" alt="">
                        <span class="pin" style="background: {{ $task['pin_color'] }};"></span>
                    </div>
                @endif
            </div>

            <div class="messages-label">Task messages (time in {{ $timezone }})</div>
            @forelse ($task['messages'] as $message)
                <div class="message">
                    <div class="author">{{ $message['author'] }}</div>
                    <div class="content">
                        @if ($message['body'])
                            <div style="font-size:9px; margin-bottom:3px;">{{ $message['body'] }}</div>
                        @endif
                        @foreach ($message['images'] as $imageUrl)
                            <img src="{{ $imageUrl }}" alt="">
                        @endforeach
                    </div>
                    <div class="when">{{ $message['at']->format('d M H:i') }}</div>
                </div>
            @empty
                <div class="muted" style="font-size:9px;">No messages.</div>
            @endforelse
        </div>
    @endforeach
@endforeach

{{-- ── Full sheets with all pins ─────────────────────────── --}}
@foreach ($sheets as $sheet)
    <div class="page-break"></div>
    <h2>{{ $sheet['sheet_number'] ?? $sheet['display_name'] }}</h2>
    <div class="muted" style="font-size:9px; margin-bottom:6px;">{{ $sheet['display_name'] }}</div>
    <div class="sheet-wrap">
        <img src="{{ $sheet['image_url'] }}" alt="">
        @foreach ($sheet['pins'] as $pin)
            <span class="sheet-pin" style="left: {{ $pin['x'] * 100 }}%; top: {{ $pin['y'] * 100 }}%;">
                <span class="dot" style="background: {{ $pin['color'] }};"></span>
                <span class="lbl">{{ $pin['label'] }}</span>
            </span>
        @endforeach
    </div>
@endforeach

<script>
    // Centre each plan-crop on its pin at the configured zoom. Runs after
    // images load (Browsershot waits for network idle before printing).
    window.addEventListener('load', function () {
        document.querySelectorAll('.plan-crop').forEach(function (box) {
            var img = box.querySelector('img');
            if (!img || !img.naturalWidth) { box.style.display = 'none'; return; }
            var zoom = parseFloat(box.dataset.zoom || '3');
            var x = parseFloat(box.dataset.x);
            var y = parseFloat(box.dataset.y);
            var scale = (box.clientWidth * zoom) / img.naturalWidth;
            var w = img.naturalWidth * scale;
            var h = img.naturalHeight * scale;
            img.style.width = w + 'px';
            img.style.height = h + 'px';
            img.style.left = (box.clientWidth / 2 - x * w) + 'px';
            img.style.top = (box.clientHeight / 2 - y * h) + 'px';
        });
    });
</script>
</body>
</html>
