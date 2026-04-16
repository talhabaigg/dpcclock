<?php

namespace App\Contracts;

interface StampsPdfOverlay
{
    /**
     * Stamp an image onto every page of an existing PDF.
     *
     * @param  string  $pdfBytes  Raw PDF content
     * @param  string  $imageBase64  Base64-encoded image (with or without data URI prefix)
     * @param  bool  $skipLastPage  Whether to skip the last page (e.g. certificate page)
     * @return string  Modified PDF bytes
     */
    public function stamp(string $pdfBytes, string $imageBase64, bool $skipLastPage = true): string;
}
