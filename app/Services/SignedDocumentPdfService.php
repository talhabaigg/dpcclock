<?php

namespace App\Services;

use App\Models\SigningRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

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

        // Strip problematic table styles
        $html = preg_replace('/(<(?:table|td|th|col|colgroup|tr)\b[^>]*?)\s*style="[^"]*"/', '$1', $html);
        $html = preg_replace('/<colgroup>.*?<\/colgroup>/s', '', $html);

        $html = $this->keepHeadingsWithContent($html);
        $html = $this->wrapInDocument($html, '');

        $pdf = Pdf::loadHTML($html)
            ->setPaper('a4', 'portrait')
            ->setOption(['margin_top' => 25, 'margin_right' => 19, 'margin_bottom' => 25, 'margin_left' => 19]);

        return $pdf->output();
    }

    public function generate(SigningRequest $signingRequest, string $signatureBase64, ?string $initialsBase64 = null): string
    {
        $html = $signingRequest->document_html;

        // Replace signature_box placeholders with actual signature image
        $signatureImgHtml = '<div class="signature-box">'
            . '<img src="' . $signatureBase64 . '" style="max-width: 300px; max-height: 100px;" />'
            . '<div class="signature-meta">'
            . '<strong>' . e($signingRequest->signer_full_name) . '</strong><br>'
            . 'Signed: ' . Carbon::parse($signingRequest->signed_at)->timezone('Australia/Sydney')->format('d/m/Y h:i A T')
            . '</div></div>';

        $html = str_replace('{{signature_box}}', $signatureImgHtml, $html);

        // Safety: remove any unreplaced sender_signature placeholders
        $html = str_replace('{{sender_signature}}', '', $html);

        // Replace date_signed placeholder
        $html = str_replace(
            '{{date_signed}}',
            Carbon::parse($signingRequest->signed_at)->timezone('Australia/Sydney')->format('d/m/Y'),
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

        $pdf = Pdf::loadHTML($html)
            ->setPaper('a4', 'portrait')
            ->setOption(['margin_top' => 25, 'margin_right' => 19, 'margin_bottom' => 25, 'margin_left' => 19]);

        $pdfOutput = $pdf->output();

        // Stamp initials on every page if provided
        if ($initialsBase64) {
            $pdfOutput = $this->stampInitialsOnAllPages($pdfOutput, $initialsBase64);
        }

        return $pdfOutput;
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
        $signedAt = Carbon::parse($signingRequest->signed_at)->timezone('Australia/Sydney');

        $senderRow = '';
        if ($signingRequest->sender_full_name) {
            $senderRow = <<<SENDER
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 200px;">Sender (Company Signatory)</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{$signingRequest->sender_full_name}</td>
                </tr>
            SENDER;
        }

        return <<<HTML
        <div style="page-break-before: always; padding: 40px; font-family: sans-serif;">
            <h2 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px;">Certificate of Signing</h2>
            <table style="width: 100%; margin-top: 20px; font-size: 13px; border-collapse: collapse;">
                {$senderRow}
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 200px;">Signer Name</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{$signingRequest->signer_full_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Signing Date & Time</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{$signedAt->format('d/m/Y h:i:s A T')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">IP Address</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{$signingRequest->signer_ip_address}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Delivery Method</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">{$signingRequest->delivery_method}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Document Hash (SHA-256)</td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 11px;">{$signingRequest->document_hash}</td>
                </tr>
            </table>
            <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 4px; font-size: 11px; color: #666;">
                This document was electronically signed in accordance with the Electronic Transactions Act 1999 (Cth).
                The electronic signature is intended to authenticate this document and has the same force and effect as a manual signature.
            </div>
        </div>
        HTML;
    }

    /**
     * Wrap each heading + its following content block in a div with page-break-inside: avoid,
     * so DomPDF keeps headings together with their content instead of orphaning them.
     * Only processes top-level headings (not those inside table cells).
     */
    private function keepHeadingsWithContent(string $html): string
    {
        $dom = new \DOMDocument();
        @$dom->loadHTML('<meta charset="utf-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

        $xpath = new \DOMXPath($dom);
        // Only select headings that are NOT inside a table
        $headings = $xpath->query('//h1[not(ancestor::table)] | //h2[not(ancestor::table)] | //h3[not(ancestor::table)]');

        foreach ($headings as $heading) {
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
            if (! in_array($tag, ['p', 'ul', 'ol', 'div'])) {
                continue;
            }

            $wrapper = $dom->createElement('div');
            $wrapper->setAttribute('style', 'page-break-inside: avoid;');

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

    private function wrapInDocument(string $bodyHtml, string $certificateHtml): string
    {
        $logoPath = public_path('logo.png');

        return <<<HTML
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: sans-serif; font-size: 11px; line-height: 1.4; color: #333; }
                h1 { font-size: 18px; margin: 8px 0 4px; }
                h2 { font-size: 14px; margin: 6px 0 3px; }
                h3 { font-size: 12px; margin: 4px 0 2px; }
                p { margin: 2px 0; }
                table { border-collapse: collapse; width: 100% !important; table-layout: fixed !important; max-width: 100% !important; }
                th, td { border: 1px solid #999; padding: 2px 4px; text-align: left; font-size: 10px; line-height: 1.3; word-wrap: break-word; overflow: hidden; }
                th { background-color: #e5e7eb; font-weight: 600; }
                col, colgroup { width: auto !important; }
                .signature-box { margin: 16px 0; padding: 10px; border: 1px solid #ccc; }
                .signature-box img { max-width: 300px; max-height: 100px; }
                .signature-meta { margin-top: 8px; font-size: 12px; color: #555; }
                ul, ol { padding-left: 20px; list-style-position: outside; }
                ol { list-style-type: decimal; }
                ul { list-style-type: disc; }
                li { margin: 1px 0; }
                h1, h2, h3 { page-break-after: avoid; }
                table, ul, ol, blockquote, p { page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="{$logoPath}" style="max-height: 50px;" alt="DPC">
            </div>
            {$bodyHtml}
            {$certificateHtml}
        </body>
        </html>
        HTML;
    }
}
