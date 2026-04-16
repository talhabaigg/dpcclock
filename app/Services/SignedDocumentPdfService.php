<?php

namespace App\Services;

use App\Models\SigningRequest;
use Carbon\Carbon;
use Spatie\Browsershot\Browsershot;

class SignedDocumentPdfService
{
    /**
     * Generate a preview PDF (unsigned) for the signer to view before signing.
     */
    public function generatePreview(SigningRequest $signingRequest): string
    {
        $html = $signingRequest->document_html;

        // Replace signature placeholders with visual placeholder boxes
        $signaturePlaceholder = '<div style="border: 2px dashed #94a3b8; border-radius: 8px; padding: 20px; text-align: center; color: #94a3b8; margin: 16px 0; font-style: italic;">Signature will appear here after signing</div>';
        $html = str_replace('{{signature_box}}', $signaturePlaceholder, $html);
        $html = str_replace('{{sender_signature}}', '', $html);
        $html = str_replace('{{date_signed}}', '<em style="color: #94a3b8;">Date will appear upon signing</em>', $html);

        return $this->buildPdf($html);
    }

    /**
     * Generate a preview PDF from a document template's raw HTML (placeholders left as-is).
     */
    public function generateTemplatePreview(string $bodyHtml): string
    {
        return $this->buildPdf($bodyHtml);
    }

    public function generate(SigningRequest $signingRequest, string $signatureBase64, ?string $initialsBase64 = null): string
    {
        $html = $signingRequest->document_html;

        // Replace signature_box placeholders with actual signature image
        $signatureImgHtml = '<div class="signature-box">'
            . '<img src="' . $signatureBase64 . '" style="max-width: 300px; max-height: 100px;" />'
            . '<div class="signature-meta">'
            . '<strong>' . e($signingRequest->signer_full_name) . '</strong><br>'
            . 'Signed: ' . Carbon::parse($signingRequest->signed_at)->timezone('Australia/Brisbane')->format('d/m/Y h:i A T')
            . '</div></div>';

        $html = str_replace('{{signature_box}}', $signatureImgHtml, $html);

        // Safety: remove any unreplaced sender_signature placeholders
        $html = str_replace('{{sender_signature}}', '', $html);

        // Replace date_signed placeholder
        $html = str_replace(
            '{{date_signed}}',
            Carbon::parse($signingRequest->signed_at)->timezone('Australia/Brisbane')->format('d/m/Y'),
            $html
        );

        // Strip all inline style attributes from table-related elements (TipTap adds widths that blow out PDF)
        $html = preg_replace('/(<(?:table|td|th|col|colgroup|tr)\b[^>]*?)\s*style="[^"]*"/', '$1', $html);
        // Remove colgroup/col elements entirely — they only carry width info
        $html = preg_replace('/<colgroup>.*?<\/colgroup>/s', '', $html);

        $html = $this->keepHeadingsWithContent($html);

        // Append Certificate of Signing page
        $certificate = $this->buildCertificateHtml($signingRequest);
        $html = $this->wrapInDocument($html, $certificate);

        $pdfOutput = $this->renderWithBrowsershot($html, self::resolveLogoFile($signingRequest));

        // Stamp initials on every page if provided
        if ($initialsBase64) {
            $pdfOutput = $this->stampInitialsOnAllPages($pdfOutput, $initialsBase64);
        }

        return $pdfOutput;
    }

    private function buildPdf(string $html): string
    {
        // Strip problematic table styles
        $html = preg_replace('/(<(?:table|td|th|col|colgroup|tr)\b[^>]*?)\s*style="[^"]*"/', '$1', $html);
        $html = preg_replace('/<colgroup>.*?<\/colgroup>/s', '', $html);

        $html = $this->keepHeadingsWithContent($html);
        $html = $this->wrapInDocument($html, '');

        return $this->renderWithBrowsershot($html);
    }

    private function renderWithBrowsershot(string $html, ?string $logoFile = null): string
    {
        $logoBase64 = $this->getLogoBase64($logoFile);

        $headerHtml = <<<HEADER
        <div style="width: 100%; padding: 10px 19mm 8px;">
            <div style="text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1e3a5f;">
                <img src="{$logoBase64}" style="max-height: 48px;" />
            </div>
        </div>
        HEADER;

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 19mm 6px;">
            <div style="display: flex; align-items: center; font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 8px; color: #6b7280; padding-top: 8px; border-top: 2px solid #1e3a5f;">
                <div style="flex: 1;"></div>
                <div style="flex: 1; text-align: center; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #1e3a5f;">Private &amp; Confidential</div>
                <div style="flex: 1; text-align: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
        </div>
        FOOTER;

        $browsershot = Browsershot::html($html)
            ->writeOptionsToFile();

        if ($nodeBinary = env('BROWSERSHOT_NODE_BINARY')) {
            $browsershot->setNodeBinary($nodeBinary);
        }
        if ($npmBinary = env('BROWSERSHOT_NPM_BINARY')) {
            $browsershot->setNpmBinary($npmBinary);
        }
        if ($chromePath = env('BROWSERSHOT_CHROME_PATH')) {
            $browsershot->setChromePath($chromePath);
        }

        return $browsershot
            ->noSandbox()
            ->format('A4')
            ->margins(35, 19, 20, 19, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();
    }

    private function getLogoBase64(?string $logoFile = null): string
    {
        $logoPath = public_path($logoFile ?? 'SWCPE_Logo.PNG');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoData = base64_encode(file_get_contents($logoPath));

        return 'data:image/png;base64,' . $logoData;
    }

    /**
     * Determine the correct logo file for a signing request based on its signable.
     */
    public static function resolveLogoFile(SigningRequest $signingRequest): ?string
    {
        $signable = $signingRequest->signable;
        if ($signable instanceof \App\Models\Employee) {
            $cmsEntityId = (int) config('services.employment_hero.cms_entity_id');
            if ((int) $signable->employing_entity_id === $cmsEntityId) {
                return 'logo-cms.png';
            }
        }

        return null;
    }

    /**
     * Use FPDI + TCPDF to overlay initials image on every page of an existing PDF.
     */
    private function stampInitialsOnAllPages(string $pdfContent, string $initialsBase64): string
    {
        // Write PDF to temp file (FPDI needs a file path)
        $tempPdf = tempnam(sys_get_temp_dir(), 'sign_') . '.pdf';
        file_put_contents($tempPdf, $pdfContent);

        // Write initials image to temp file
        $initialsData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $initialsBase64));
        $tempInitials = tempnam(sys_get_temp_dir(), 'init_') . '.png';
        file_put_contents($tempInitials, $initialsData);

        try {
            $fpdi = new \setasign\Fpdi\Tcpdf\Fpdi();
            $fpdi->setPrintHeader(false);
            $fpdi->setPrintFooter(false);
            $fpdi->SetAutoPageBreak(false, 0);

            $pageCount = $fpdi->setSourceFile($tempPdf);

            for ($i = 1; $i <= $pageCount; $i++) {
                $template = $fpdi->importPage($i);
                $size = $fpdi->getTemplateSize($template);
                $fpdi->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $fpdi->useTemplate($template);

                // Stamp initials on document pages only, skip the certificate (last page)
                if ($i < $pageCount) {
                    // Stamp initials in bottom-right corner — 30x15mm, within the margin area
                    $fpdi->Image(
                        $tempInitials,
                        $size['width'] - 45,  // 45mm from right edge
                        $size['height'] - 20, // 20mm from bottom edge
                        30,                    // 30mm wide
                        15,                    // 15mm tall
                    );
                }
            }

            return $fpdi->Output('', 'S');
        } finally {
            @unlink($tempPdf);
            @unlink($tempInitials);
        }
    }

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

    /**
     * Wrap each heading + its following content block in a div with page-break-inside: avoid,
     * so the PDF renderer keeps headings together with their content instead of orphaning them.
     * Only processes top-level headings (not those inside table cells).
     */
    private function keepHeadingsWithContent(string $html): string
    {
        $dom = new \DOMDocument();
        @$dom->loadHTML('<meta charset="utf-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

        $xpath = new \DOMXPath($dom);
        // Select headings and bold-only paragraphs (acting as section titles) that are NOT inside a table
        $headings = $xpath->query(
            '//h1[not(ancestor::table)] | //h2[not(ancestor::table)] | //h3[not(ancestor::table)]'
            . ' | //p[not(ancestor::table) and count(child::*)=1 and child::strong and normalize-space(.)!=""]'
        );

        foreach ($headings as $heading) {
            // Check if a page-break div immediately precedes this heading
            $prev = $heading->previousSibling;
            while ($prev && $prev->nodeType === XML_TEXT_NODE && trim($prev->textContent) === '') {
                $prev = $prev->previousSibling;
            }
            $hasPageBreakBefore = $prev instanceof \DOMElement && $prev->hasAttribute('data-page-break');

            $sibling = $heading->nextSibling;
            // Skip whitespace text nodes
            while ($sibling && $sibling->nodeType === XML_TEXT_NODE && trim($sibling->textContent) === '') {
                $sibling = $sibling->nextSibling;
            }

            if (! $sibling || ! ($sibling instanceof \DOMElement)) {
                continue;
            }

            // Only wrap with block-level content siblings
            $tag = strtolower($sibling->tagName);
            if (! in_array($tag, ['p', 'ul', 'ol', 'div', 'table'])) {
                continue;
            }

            if ($hasPageBreakBefore) {
                $wrapper = $dom->createElement('div');
                $wrapper->setAttribute('style', 'page-break-before: always; page-break-inside: avoid;');

                // Remove the page-break div — the wrapper's style handles it now
                $prev->parentNode->removeChild($prev);

                $heading->parentNode->insertBefore($wrapper, $heading);
                $wrapper->appendChild($heading);
                $wrapper->appendChild($sibling);
            } else {
                $wrapper = $dom->createElement('div');
                $wrapper->setAttribute('style', 'page-break-inside: avoid;');

                $heading->parentNode->insertBefore($wrapper, $heading);
                $wrapper->appendChild($heading);
                $wrapper->appendChild($sibling);
            }
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
                ul { padding-left: 22px; list-style-position: outside; list-style-type: disc; }
                ol { padding-left: 22px; list-style-position: outside; list-style-type: decimal; }
                ol[data-list-style="legal"] { padding-left: 0; list-style-type: none; counter-reset: legal; }
                ol[data-list-style="legal"] > li { counter-increment: legal; position: relative; padding-left: 30px; }
                ol[data-list-style="legal"] > li::before { content: counters(legal, ".") "."; font-weight: 600; position: absolute; left: 0; }
                ol[data-list-style="legal"] ol:not([data-list-style]) { padding-left: 0; margin: 2px 0; list-style-type: none; counter-reset: legal; }
                ol[data-list-style="legal"] ol:not([data-list-style]) > li { counter-increment: legal; position: relative; padding-left: 30px; }
                ol[data-list-style="legal"] ol:not([data-list-style]) > li::before { content: counters(legal, ".") "."; font-weight: 600; position: absolute; left: 0; }
                ol[data-list-style="alpha"] { list-style-type: lower-alpha; }
                li { margin: 2px 0; }

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
}
