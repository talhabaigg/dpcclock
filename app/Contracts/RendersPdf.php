<?php

namespace App\Contracts;

use App\DTOs\PdfRenderOptions;

interface RendersPdf
{
    /**
     * Render a complete HTML document string to raw PDF bytes.
     */
    public function render(string $html, PdfRenderOptions $options): string;
}
