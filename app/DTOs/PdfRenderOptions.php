<?php

namespace App\DTOs;

final class PdfRenderOptions
{
    public function __construct(
        public readonly ?string $headerHtml = null,
        public readonly ?string $footerHtml = null,
        public readonly string $format = 'A4',
        public readonly array $margins = [35, 19, 20, 19],
    ) {}
}
