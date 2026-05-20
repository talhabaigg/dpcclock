<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $formRequest->formTemplate->name }}</title>
    @vite(['resources/js/form-fill.ts'])
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

        /* Form card */
        .form-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
        .form-header { padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .form-header h2 { font-size: 14px; font-weight: 600; color: #334155; }
        .form-body { padding: 24px 28px; }

        /* Field groups */
        .field-group { margin-bottom: 20px; }
        .field-group:last-child { margin-bottom: 0; }
        .field-group.is-hidden { display: none; }
        .field-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #1e293b; }
        .field-group .required-star { color: #dc2626; margin-left: 2px; }
        .field-group .help-text { font-size: 12px; color: #64748b; margin-top: 4px; }
        .field-group .field-error { font-size: 12px; color: #dc2626; margin-top: 4px; display: none; }
        .field-group .field-error.visible { display: block; }

        /* Inputs */
        .field-group input[type="text"],
        .field-group input[type="email"],
        .field-group input[type="number"],
        .field-group input[type="tel"],
        .field-group input[type="date"],
        .field-group select,
        .field-group textarea {
            width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px;
            font-size: 15px; color: #1e293b; background: #fff; font-family: inherit;
        }
        .field-group input:focus, .field-group select:focus, .field-group textarea:focus {
            outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .field-group input.has-error, .field-group select.has-error, .field-group textarea.has-error {
            border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }
        .field-group textarea { resize: vertical; min-height: 100px; }
        .field-group select { appearance: auto; }

        /* Radio & checkbox groups */
        .option-list { display: flex; flex-direction: column; gap: 8px; }
        .option-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #334155; cursor: pointer; }
        .option-item input[type="radio"],
        .option-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #2563eb; flex-shrink: 0; }

        /* Display-only types */
        .section-heading { font-size: 17px; font-weight: 600; color: #0f172a; padding: 8px 0 4px; border-bottom: 2px solid #e2e8f0; margin-bottom: 4px; }
        .info-text { font-size: 14px; color: #64748b; line-height: 1.6; padding: 4px 0; }

        /* Multi-select (native — falls back gracefully on iOS) */
        .multiselect-native { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; font-family: inherit; background: #fff; }

        /* Button group (iPad-friendly) */
        .button-group { display: flex; flex-wrap: wrap; gap: 8px; }
        .btn-option { flex: 1 1 auto; min-width: 90px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
            padding: 10px 16px; border: 1px solid #d1d5db; border-radius: 10px; background: #fff; color: #1e293b;
            font-size: 15px; font-weight: 500; cursor: pointer; user-select: none; transition: background 0.12s, border-color 0.12s, color 0.12s; }
        .btn-option:hover { background: #f8fafc; }
        .btn-option input { position: absolute; opacity: 0; pointer-events: none; }
        .btn-option:has(input:checked) { background: #2563eb; border-color: #2563eb; color: #fff; }

        /* Pagination */
        .page-indicator { font-size: 12px; color: #64748b; text-align: right; padding: 0 20px 8px; }
        .nav-buttons { display: flex; gap: 10px; }
        .nav-buttons .submit-btn { flex: 1; }
        .nav-btn { flex: 1; padding: 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; font-family: inherit; }
        .nav-btn.nav-back { background: #fff; color: #334155; }
        .nav-btn.nav-back:hover { background: #f8fafc; }
        .nav-btn.nav-next { background: #2563eb; color: #fff; border-color: #2563eb; }
        .nav-btn.nav-next:hover { background: #1d4ed8; }

        /* Signature */
        .signature-block { display: flex; flex-direction: column; gap: 6px; }
        .signature-canvas { width: 100%; height: 180px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; touch-action: none; cursor: crosshair; }
        .signature-canvas.has-error { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1); }
        .signature-clear { align-self: flex-start; padding: 4px 10px; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; color: #64748b; cursor: pointer; font-family: inherit; }
        .signature-clear:hover { background: #f8fafc; color: #1e293b; }

        /* Submit area */
        .submit-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
        .submit-btn { width: 100%; padding: 14px; background: #2563eb; color: #fff; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .submit-btn:hover { background: #1d4ed8; }
        .submit-btn:disabled { background: #93c5fd; cursor: not-allowed; }
        .submit-error { color: #dc2626; font-size: 13px; margin-bottom: 12px; display: none; text-align: center; }
        .submit-error.visible { display: block; }

        /* Footer */
        .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #94a3b8; }

        /* Mobile */
        @media (max-width: 640px) {
            .container { padding: 12px; }
            .form-body { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="{{ asset('logo.png') }}" alt="DPC">
            <h1>{{ $formRequest->formTemplate->name }}</h1>
            <p>Please fill out the form below</p>
        </div>

        <div class="greeting">
            Hi <strong>{{ $formRequest->recipient_name }}</strong>, please complete the following form and submit when ready.
        </div>

        @if(($pendingDocuments ?? collect())->count() + ($pendingForms ?? collect())->count() > 0)
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 20px; margin-bottom: 16px; font-size: 14px; color: #1e40af;">
                After submitting this form you'll be taken to the next item automatically.
            </div>
        @endif

        <form id="form-fill" method="POST" action="{{ route('form.submit', $token) }}">
            @csrf

            <div class="form-card">
                <div class="form-header">
                    <h2>{{ $formRequest->formTemplate->name }}</h2>
                </div>
                <div class="form-body">
                    @php
                        // Split fields into pages on page_break markers. Markers don't
                        // render themselves — they're just separators. Single-page forms
                        // (no markers) get one page containing everything.
                        $pages = [[]];
                        foreach ($fields as $f) {
                            if ($f->type === 'page_break') {
                                $pages[] = [];
                            } else {
                                $pages[count($pages) - 1][] = $f;
                            }
                        }
                        $pages = array_values(array_filter($pages, fn ($p) => ! empty($p)));
                        $pageCount = count($pages);
                    @endphp
                    @if($pageCount > 1)
                        <div class="page-indicator" id="page-indicator">Page <span id="page-current">1</span> of {{ $pageCount }}</div>
                    @endif
                    @foreach($pages as $pageIndex => $pageFields)
                    <div class="form-page" data-page="{{ $pageIndex }}" @if($pageIndex > 0) style="display:none" @endif>
                    @foreach($pageFields as $field)
                        @php $visibleIfAttr = $field->visible_if ? json_encode($field->visible_if) : null; @endphp
                        @if($field->type === 'heading')
                            <div class="field-group" data-field-id="{{ $field->id }}" data-field-type="heading" @if($visibleIfAttr) data-visible-if='{{ $visibleIfAttr }}' @endif>
                                <div class="section-heading">{{ $field->label }}</div>
                            </div>
                        @elseif($field->type === 'paragraph')
                            <div class="field-group" data-field-id="{{ $field->id }}" data-field-type="paragraph" @if($visibleIfAttr) data-visible-if='{{ $visibleIfAttr }}' @endif>
                                <div class="info-text">{{ $field->label }}</div>
                            </div>
                        @else
                            <div class="field-group" data-field-id="{{ $field->id }}" data-field-type="{{ $field->type }}" @if($visibleIfAttr) data-visible-if='{{ $visibleIfAttr }}' @endif>
                                <label for="field_{{ $field->id }}">
                                    {{ $field->label }}
                                    @if($field->is_required)
                                        <span class="required-star">*</span>
                                    @endif
                                </label>

                                @php
                                    $defaultValue = $field->default_value ?? '';
                                    $defaultArray = array_filter(array_map('trim', explode(',', $defaultValue)), fn ($v) => $v !== '');
                                @endphp

                                @if($field->type === 'text')
                                    <input type="text" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        value="{{ $defaultValue }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'email')
                                    <input type="email" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        value="{{ $defaultValue }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'number')
                                    <input type="number" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        value="{{ $defaultValue }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'phone')
                                    <input type="tel" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        value="{{ $defaultValue }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'date')
                                    <input type="date" id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        value="{{ $defaultValue }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                @elseif($field->type === 'textarea')
                                    <textarea id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        placeholder="{{ $field->placeholder }}"
                                        {{ $field->is_required ? 'required' : '' }}>{{ $defaultValue }}</textarea>
                                @elseif($field->type === 'select')
                                    <select id="field_{{ $field->id }}" name="field_{{ $field->id }}"
                                        {{ $field->is_required ? 'required' : '' }}>
                                        <option value="">Select an option</option>
                                        @foreach($field->options ?? [] as $option)
                                            <option value="{{ $option['value'] }}" {{ (string) $option['value'] === (string) $defaultValue ? 'selected' : '' }}>{{ $option['label'] }}</option>
                                        @endforeach
                                    </select>
                                @elseif($field->type === 'radio')
                                    <div class="option-list">
                                        @foreach($field->options ?? [] as $option)
                                            <label class="option-item">
                                                <input type="radio" name="field_{{ $field->id }}" value="{{ $option['value'] }}"
                                                    {{ (string) $option['value'] === (string) $defaultValue ? 'checked' : '' }}
                                                    {{ $field->is_required ? 'required' : '' }}>
                                                {{ $option['label'] }}
                                            </label>
                                        @endforeach
                                    </div>
                                @elseif($field->type === 'checkbox')
                                    <div class="option-list">
                                        @foreach($field->options ?? [] as $option)
                                            <label class="option-item">
                                                <input type="checkbox" name="field_{{ $field->id }}[]" value="{{ $option['value'] }}"
                                                    {{ in_array((string) $option['value'], array_map('strval', $defaultArray), true) ? 'checked' : '' }}>
                                                {{ $option['label'] }}
                                            </label>
                                        @endforeach
                                    </div>
                                @elseif($field->type === 'multiselect')
                                    <select name="field_{{ $field->id }}[]" multiple size="6"
                                        class="multiselect-native"
                                        {{ $field->is_required ? 'required' : '' }}>
                                        @foreach($field->options ?? [] as $option)
                                            <option value="{{ $option['value'] }}"
                                                {{ in_array((string) $option['value'], array_map('strval', $defaultArray), true) ? 'selected' : '' }}>{{ $option['label'] }}</option>
                                        @endforeach
                                    </select>
                                @elseif($field->type === 'button_group')
                                    <div class="button-group">
                                        @foreach($field->options ?? [] as $option)
                                            <label class="btn-option">
                                                <input type="radio" name="field_{{ $field->id }}" value="{{ $option['value'] }}"
                                                    {{ (string) $option['value'] === (string) $defaultValue ? 'checked' : '' }}
                                                    {{ $field->is_required ? 'required' : '' }}>
                                                <span>{{ $option['label'] }}</span>
                                            </label>
                                        @endforeach
                                    </div>
                                @elseif($field->type === 'button_group_multi')
                                    <div class="button-group option-list">
                                        @foreach($field->options ?? [] as $option)
                                            <label class="btn-option">
                                                <input type="checkbox" name="field_{{ $field->id }}[]" value="{{ $option['value'] }}"
                                                    {{ in_array((string) $option['value'], array_map('strval', $defaultArray), true) ? 'checked' : '' }}>
                                                <span>{{ $option['label'] }}</span>
                                            </label>
                                        @endforeach
                                    </div>
                                @elseif($field->type === 'signature')
                                    <div class="signature-block" data-signature-field="{{ $field->id }}">
                                        <canvas class="signature-canvas" data-signature-canvas-for="{{ $field->id }}" width="600" height="180"></canvas>
                                        <input type="hidden" name="field_{{ $field->id }}" id="field_{{ $field->id }}" data-signature-hidden-for="{{ $field->id }}" value="">
                                        <button type="button" class="signature-clear" data-signature-clear-for="{{ $field->id }}">Clear</button>
                                    </div>
                                @endif

                                @if($field->help_text)
                                    <div class="help-text">{{ $field->help_text }}</div>
                                @endif
                                <div class="field-error" id="error_field_{{ $field->id }}"></div>
                            </div>
                        @endif
                    @endforeach
                    </div>
                    @endforeach
                </div>
            </div>

            <div class="submit-section">
                <p class="submit-error" id="submit-error"></p>
                @if($pageCount > 1)
                    <div class="nav-buttons" data-page-count="{{ $pageCount }}">
                        <button type="button" class="nav-btn nav-back" id="nav-prev" style="display:none">Previous</button>
                        <button type="button" class="nav-btn nav-next" id="nav-next">Next</button>
                        <button type="submit" class="submit-btn" id="submit-btn" style="display:none">Submit Form</button>
                    </div>
                @else
                    <button type="submit" class="submit-btn" id="submit-btn">Submit Form</button>
                @endif
            </div>
        </form>

        <div class="footer">
            @if($formRequest->expires_at)
                This link expires {{ $formRequest->expires_at->timezone('Australia/Sydney')->format('d M Y \\a\\t h:i A') }} AEST
            @endif
        </div>
    </div>
</body>
</html>
