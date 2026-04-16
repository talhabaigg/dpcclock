<?php

namespace App\Services\Adapters;

use App\Contracts\RendersPdf;
use App\DTOs\PdfRenderOptions;
use Spatie\Browsershot\Browsershot;

class BrowsershotPdfRenderer implements RendersPdf
{
    public function render(string $html, PdfRenderOptions $options): string
    {
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

        $browsershot
            ->noSandbox()
            ->format($options->format)
            ->margins($options->margins[0], $options->margins[1], $options->margins[2], $options->margins[3], 'mm')
            ->showBackground();

        if ($options->headerHtml || $options->footerHtml) {
            $browsershot->showBrowserHeaderAndFooter();

            if ($options->headerHtml) {
                $browsershot->headerHtml($options->headerHtml);
            }
            if ($options->footerHtml) {
                $browsershot->footerHtml($options->footerHtml);
            }
        }

        return $browsershot->pdf();
    }
}
