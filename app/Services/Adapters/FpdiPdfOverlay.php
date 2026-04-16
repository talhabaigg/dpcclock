<?php

namespace App\Services\Adapters;

use App\Contracts\StampsPdfOverlay;

class FpdiPdfOverlay implements StampsPdfOverlay
{
    public function stamp(string $pdfBytes, string $imageBase64, bool $skipLastPage = true): string
    {
        // Write PDF to temp file (FPDI needs a file path)
        $tempPdf = tempnam(sys_get_temp_dir(), 'sign_') . '.pdf';
        file_put_contents($tempPdf, $pdfBytes);

        // Write image to temp file
        $imageData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $imageBase64));
        $tempImage = tempnam(sys_get_temp_dir(), 'init_') . '.png';
        file_put_contents($tempImage, $imageData);

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

                // Stamp on document pages, skip the last page (certificate) if requested
                if (! $skipLastPage || $i < $pageCount) {
                    $fpdi->Image(
                        $tempImage,
                        $size['width'] - 45,
                        $size['height'] - 20,
                        30,
                        15,
                    );
                }
            }

            return $fpdi->Output('', 'S');
        } finally {
            @unlink($tempPdf);
            @unlink($tempImage);
        }
    }
}
