<?php

namespace App\Services;

use App\Models\SigningRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class SignedDocumentPdfService
{
    public function generate(SigningRequest $signingRequest, string $signatureBase64): string
    {
        $html = $signingRequest->document_html;

        // Replace signature_box placeholders with actual signature image
        $signatureImgHtml = '<div style="margin: 20px 0; padding: 10px; border: 1px solid #ccc;">'
            . '<img src="' . $signatureBase64 . '" style="max-width: 300px; max-height: 100px;" />'
            . '<div style="margin-top: 8px; font-size: 12px; color: #555;">'
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

        // Append Certificate of Signing page
        $certificate = $this->buildCertificateHtml($signingRequest);
        $html = $this->wrapInDocument($html, $certificate);

        $pdf = Pdf::loadHTML($html)
            ->setPaper('a4', 'portrait')
            ->setOption(['margin_top' => 15, 'margin_right' => 15, 'margin_bottom' => 15, 'margin_left' => 15]);

        return $pdf->output();
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
                ul, ol { padding-left: 20px; }
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
