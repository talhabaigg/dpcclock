<?php

namespace App\Services;

use App\Enums\RenderStage;
use App\Models\SigningRequest;
use Carbon\Carbon;

class DocumentHtmlAssembler
{
    /**
     * Assemble document HTML for a given render stage.
     *
     * Handles generic placeholder substitution, stage-specific special token
     * replacement (signature_box, sender_signature, date_signed), sender
     * signature stamping, and table/heading cleanup for PDF stages.
     */
    public function assemble(
        string $html,
        RenderStage $stage,
        array $placeholders = [],
        ?SigningRequest $signingRequest = null,
        ?string $senderSignature = null,
        ?string $senderName = null,
        ?string $senderPosition = null,
        ?string $recipientSignature = null,
        ?string $recipientName = null,
        ?\DateTimeInterface $signedAt = null,
    ): string {
        // Substitute generic {{key}} placeholders
        foreach ($placeholders as $key => $value) {
            $html = str_replace('{{' . $key . '}}', e($value), $html);
        }

        // Auto-append recipient signature block if missing (one-off documents)
        if (! str_contains($html, '{{signature_box}}') && $stage !== RenderStage::Signed) {
            // Only append for stages that expect a signature box
            if (in_array($stage, [RenderStage::Final, RenderStage::Preview, RenderStage::Internal])) {
                $html .= '<p>{{signature_box}}</p>';
            }
        }

        // Stamp sender signature (Final and Signed stages)
        if ($senderSignature && str_contains($html, '{{sender_signature}}')) {
            $html = str_replace(
                '{{sender_signature}}',
                $this->buildSignatureHtml($senderSignature, $senderName, $senderPosition),
                $html,
            );
        }

        // Stage-specific handling of special tokens
        $html = match ($stage) {
            RenderStage::Final => $this->renderFinalTokens($html),
            RenderStage::Preview => $this->renderPreviewTokens($html),
            RenderStage::Internal => $this->renderInternalTokens($html),
            RenderStage::Signed => $this->renderSignedTokens(
                $html, $signingRequest, $recipientSignature, $recipientName, $signedAt,
            ),
        };

        // Table style stripping and heading cleanup for PDF-destined stages
        if ($stage === RenderStage::Signed) {
            $html = $this->stripTableStyles($html);
            $html = $this->keepHeadingsWithContent($html);
        }

        return $html;
    }

    /**
     * Wrap assembled HTML in a full document shell for PDF rendering.
     * Optionally appends a Certificate of Signing page.
     */
    public function wrapForPdf(string $bodyHtml, ?SigningRequest $signingRequest = null): string
    {
        $certificateHtml = $signingRequest ? $this->buildCertificateHtml($signingRequest) : '';

        return $this->wrapInDocument($bodyHtml, $certificateHtml);
    }

    /**
     * Build header HTML for the PDF renderer.
     */
    public function buildHeaderHtml(?string $logoFile = null): string
    {
        $logoBase64 = $this->getLogoBase64($logoFile);

        return <<<HTML
        <div style="width: 100%; padding: 10px 19mm 8px;">
            <div style="text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1e3a5f;">
                <img src="{$logoBase64}" style="max-height: 48px;" />
            </div>
        </div>
        HTML;
    }

    /**
     * Build footer HTML for the PDF renderer.
     */
    public function buildFooterHtml(): string
    {
        return <<<HTML
        <div style="width: 100%; padding: 0 19mm 6px;">
            <div style="display: flex; align-items: center; font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 8px; color: #6b7280; padding-top: 8px; border-top: 2px solid #1e3a5f;">
                <div style="flex: 1;"></div>
                <div style="flex: 1; text-align: center; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #1e3a5f;">Private &amp; Confidential</div>
                <div style="flex: 1; text-align: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
        </div>
        HTML;
    }

    /**
     * Resolve the correct logo file for a signing request based on its signable.
     */
    public static function resolveLogoFile(?SigningRequest $signingRequest): ?string
    {
        if (! $signingRequest) {
            return null;
        }

        $signable = $signingRequest->signable;
        if ($signable instanceof \App\Models\Employee) {
            $cmsEntityId = (int) config('services.employment_hero.cms_entity_id');
            if ((int) $signable->employing_entity_id === $cmsEntityId) {
                return 'logo-cms.png';
            }
        }

        return null;
    }

    // ─── Signature HTML builders ────────────────────────────────

    /**
     * Build the inline HTML for a signature stamp (used for both sender and recipient).
     */
    public function buildSignatureHtml(
        string $signatureDataUrl,
        ?string $name = null,
        ?string $position = null,
        ?\DateTimeInterface $signedAt = null,
    ): string {
        $positionLine = $position
            ? '<span style="color: #475569;">' . e($position) . '</span><br>'
            : '';

        $dateLine = $signedAt
            ? Carbon::parse($signedAt)->timezone('Australia/Brisbane')->format('d/m/Y h:i A T')
            : now()->timezone('Australia/Brisbane')->format('d/m/Y h:i A T');

        return '<div class="signature-box">'
            . '<img src="' . $signatureDataUrl . '" style="max-width: 300px; max-height: 100px;" />'
            . '<div class="signature-meta">'
            . '<strong>' . e($name ?? '') . '</strong><br>'
            . $positionLine
            . 'Signed: ' . $dateLine
            . '</div></div>';
    }

    // ─── Stage-specific token handlers ──────────────────────────

    private function renderFinalTokens(string $html): string
    {
        // sender_signature left unresolved if not stamped above (e.g. awaiting internal signer)
        // signature_box and date_signed stay as-is — they're resolved when the signer signs
        return $html;
    }

    private function renderPreviewTokens(string $html): string
    {
        $html = str_replace(
            '{{signature_box}}',
            '<div class="signature-placeholder">Your signature will appear here after signing below</div>',
            $html,
        );
        $html = str_replace('{{sender_signature}}', '', $html);
        $html = str_replace(
            '{{date_signed}}',
            '<em style="color: #94a3b8;">Will be filled upon signing</em>',
            $html,
        );

        return $html;
    }

    private function renderInternalTokens(string $html): string
    {
        $html = str_replace(
            '{{signature_box}}',
            '<div class="signature-placeholder">Recipient signature will appear here after they sign</div>',
            $html,
        );
        $html = str_replace(
            '{{sender_signature}}',
            '<div class="signature-placeholder" style="border-color: #f59e0b; background: #fffbeb;">Your signature will be placed here</div>',
            $html,
        );
        $html = str_replace(
            '{{date_signed}}',
            '<em style="color: #94a3b8;">Will be filled upon signing</em>',
            $html,
        );

        return $html;
    }

    private function renderSignedTokens(
        string $html,
        ?SigningRequest $signingRequest,
        ?string $recipientSignature,
        ?string $recipientName,
        ?\DateTimeInterface $signedAt,
    ): string {
        // Stamp recipient signature
        if ($recipientSignature && $signingRequest) {
            $name = $recipientName ?? $signingRequest->signer_full_name;
            $date = $signedAt ?? $signingRequest->signed_at;

            $html = str_replace(
                '{{signature_box}}',
                $this->buildSignatureHtml($recipientSignature, $name, signedAt: $date),
                $html,
            );
        }

        // Safety: remove any unreplaced sender_signature placeholders
        $html = str_replace('{{sender_signature}}', '', $html);

        // Replace date_signed placeholder
        $dateFormatted = $signedAt
            ? Carbon::parse($signedAt)->timezone('Australia/Brisbane')->format('d/m/Y')
            : ($signingRequest?->signed_at
                ? Carbon::parse($signingRequest->signed_at)->timezone('Australia/Brisbane')->format('d/m/Y')
                : now()->timezone('Australia/Brisbane')->format('d/m/Y'));

        $html = str_replace('{{date_signed}}', $dateFormatted, $html);

        return $html;
    }

    // ─── HTML cleanup for PDF ───────────────────────────────────

    private function stripTableStyles(string $html): string
    {
        // Strip inline style attributes from table elements (TipTap adds widths that blow out PDF)
        $html = preg_replace('/(<(?:table|td|th|col|colgroup|tr)\b[^>]*?)\s*style="[^"]*"/', '$1', $html);
        // Remove colgroup/col elements entirely
        $html = preg_replace('/<colgroup>.*?<\/colgroup>/s', '', $html);

        return $html;
    }

    /**
     * Wrap each heading + its following content block in a div with page-break-inside: avoid,
     * so the PDF renderer keeps headings together with their content.
     */
    private function keepHeadingsWithContent(string $html): string
    {
        $dom = new \DOMDocument();
        @$dom->loadHTML('<meta charset="utf-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

        $xpath = new \DOMXPath($dom);
        $headings = $xpath->query(
            '//h1[not(ancestor::table)] | //h2[not(ancestor::table)] | //h3[not(ancestor::table)]'
            . ' | //p[not(ancestor::table) and count(child::*)=1 and child::strong and normalize-space(.)!=""]'
        );

        foreach ($headings as $heading) {
            $prev = $heading->previousSibling;
            while ($prev && $prev->nodeType === XML_TEXT_NODE && trim($prev->textContent) === '') {
                $prev = $prev->previousSibling;
            }
            $hasPageBreakBefore = $prev instanceof \DOMElement && $prev->hasAttribute('data-page-break');

            $sibling = $heading->nextSibling;
            while ($sibling && $sibling->nodeType === XML_TEXT_NODE && trim($sibling->textContent) === '') {
                $sibling = $sibling->nextSibling;
            }

            if (! $sibling || ! ($sibling instanceof \DOMElement)) {
                continue;
            }

            $tag = strtolower($sibling->tagName);
            if (! in_array($tag, ['p', 'ul', 'ol', 'div', 'table'])) {
                continue;
            }

            $wrapper = $dom->createElement('div');

            if ($hasPageBreakBefore) {
                $wrapper->setAttribute('style', 'page-break-before: always; page-break-inside: avoid;');
                $prev->parentNode->removeChild($prev);
            } else {
                $wrapper->setAttribute('style', 'page-break-inside: avoid;');
            }

            $heading->parentNode->insertBefore($wrapper, $heading);
            $wrapper->appendChild($heading);
            $wrapper->appendChild($sibling);
        }

        $body = $dom->getElementsByTagName('body')->item(0);
        if (! $body) {
            return $html;
        }

        $result = '';
        foreach ($body->childNodes as $child) {
            $result .= $dom->saveHTML($child);
        }

        return $result;
    }

    // ─── Document wrapping ──────────────────────────────────────

    private function wrapInDocument(string $bodyHtml, string $certificateHtml): string
    {
        return <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    font-size: 12px;
                    line-height: 1.5;
                    color: #1a1a1a;
                }
                h1 { font-size: 20px; font-weight: 700; margin: 14px 0 6px; color: #111; }
                h2 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; color: #111; }
                h3 { font-size: 13px; font-weight: 600; margin: 10px 0 3px; color: #222; }
                p { margin: 4px 0; }

                /* Tables */
                table { border-collapse: collapse; width: 100% !important; table-layout: fixed !important; max-width: 100% !important; }
                th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-size: 11px; line-height: 1.4; word-wrap: break-word; overflow: hidden; }
                th { background-color: #1e3a5f; color: #fff; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
                tr:nth-child(even) td { background-color: #f8fafc; }
                col, colgroup { width: auto !important; }

                /* Signature */
                .signature-box { margin: 20px 0; padding: 16px; page-break-inside: avoid; }
                .signature-box img { max-width: 300px; max-height: 100px; }
                .signature-meta { margin-top: 10px; font-size: 11px; color: #4b5563; }

                /* Lists */
                ul { padding-left: 16px; list-style-position: outside; list-style-type: disc; }
                ol { padding-left: 16px; list-style-position: outside; list-style-type: decimal; }
                ol[data-list-style="legal"],
                ol[data-list-style="legal"] ol:not([data-list-style="alpha"]) { padding-left: 0 !important; list-style-type: none !important; counter-reset: legal; }
                ol[data-list-style="legal"] ol:not([data-list-style="alpha"]) { margin: 2px 0; }
                ol[data-list-style="legal"] > li,
                ol[data-list-style="legal"] ol:not([data-list-style="alpha"]) > li { counter-increment: legal; position: relative; padding-left: 30px; }
                ol[data-list-style="legal"] > li::before { content: counter(legal) "."; font-weight: 600; position: absolute; left: 0; }
                ol[data-list-style="legal"] ol:not([data-list-style="alpha"]) > li::before { content: counters(legal, ".") "."; font-weight: 600; position: absolute; left: 0; }
                ol[data-list-style="alpha"],
                ol[data-list-style="alpha"] ol:not([data-list-style="legal"]) { list-style-type: lower-alpha; }
                li { margin: 2px 0; }
                li > p { margin-left: 0 !important; }
                li > ul { list-style-type: circle; margin: 2px 0; }
                li > ul > li > ul { list-style-type: square; }
                li > ol { margin: 2px 0; }

                /* Print control */
                h1, h2, h3 { page-break-after: avoid; }
                blockquote, p, li { page-break-inside: avoid; }
                .page-break { page-break-after: always; border: none; margin: 0; padding: 0; height: 0; }
            </style>
        </head>
        <body>
            {$bodyHtml}
            {$certificateHtml}
        </body>
        </html>
        HTML;
    }

    // ─── Certificate of Signing ─────────────────────────────────

    private function buildCertificateHtml(SigningRequest $signingRequest): string
    {
        $signedAt = Carbon::parse($signingRequest->signed_at)->timezone('Australia/Brisbane');

        $senderRow = '';
        if ($signingRequest->sender_full_name) {
            $senderRow = <<<SENDER
                <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 200px; color: #374151; background: #f9fafb;">Sender (Company Signatory)</td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">{$signingRequest->sender_full_name}</td>
                </tr>
            SENDER;
        }

        return <<<HTML
        <div style="page-break-before: always; padding: 40px 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-block; background: #1e3a5f; color: #fff; padding: 4px 18px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">Certificate of Signing</div>
                <h2 style="font-size: 18px; font-weight: 700; color: #1a1a1a; margin: 10px 0 0;">Electronic Signature Verification</h2>
            </div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 4px;">
                {$senderRow}
                <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 200px; color: #374151; background: #f9fafb;">Signer Name</td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">{$signingRequest->signer_full_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; background: #f9fafb;">Signing Date &amp; Time</td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">{$signedAt->format('d/m/Y h:i:s A T')}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; background: #f9fafb;">IP Address</td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">{$signingRequest->signer_ip_address}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151; background: #f9fafb;">Delivery Method</td>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #1a1a1a;">{$signingRequest->delivery_method}</td>
                </tr>
                <tr>
                    <td style="padding: 10px 14px; font-weight: 600; color: #374151; background: #f9fafb;">Document Hash (SHA-256)</td>
                    <td style="padding: 10px 14px; font-family: 'SF Mono', 'Fira Code', Consolas, monospace; font-size: 10px; color: #4b5563; word-break: break-all;">{$signingRequest->document_hash}</td>
                </tr>
            </table>
            <div style="margin-top: 24px; padding: 14px 16px; background: #f0f4f8; border-left: 3px solid #1e3a5f; border-radius: 2px; font-size: 10px; color: #4b5563; line-height: 1.5;">
                This document was electronically signed in accordance with the <em>Electronic Transactions Act 1999</em> (Cth).
                The electronic signature is intended to authenticate this document and has the same force and effect as a manual signature.
            </div>
        </div>
        HTML;
    }

    // ─── Logo helpers ───────────────────────────────────────────

    private function getLogoBase64(?string $logoFile = null): string
    {
        $logoPath = public_path($logoFile ?? 'SWCPE_Logo.PNG');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoData = base64_encode(file_get_contents($logoPath));

        return 'data:image/png;base64,' . $logoData;
    }
}
