<?php

namespace App\Services;

use App\Contracts\RendersPdf;
use App\Contracts\StampsPdfOverlay;
use App\DTOs\PdfRenderOptions;
use App\Enums\RenderStage;
use App\Models\SigningRequest;

class SignedDocumentPdfService
{
    public function __construct(
        private DocumentHtmlAssembler $assembler,
        private RendersPdf $pdfRenderer,
        private StampsPdfOverlay $overlay,
    ) {}

    /**
     * Generate a preview PDF (unsigned) for the signer to view before signing.
     */
    public function generatePreview(SigningRequest $signingRequest): string
    {
        $html = $this->assembler->assemble($signingRequest->document_html, RenderStage::Preview);
        $html = $this->assembler->wrapForPdf($html);

        return $this->renderPdf($html);
    }

    /**
     * Generate a preview PDF from a document template's raw HTML.
     */
    public function generateTemplatePreview(string $bodyHtml): string
    {
        $html = $this->assembler->wrapForPdf($bodyHtml);

        return $this->renderPdf($html);
    }

    /**
     * Generate the fully signed PDF with certificate and optional initials.
     */
    public function generate(SigningRequest $signingRequest, string $signatureBase64, ?string $initialsBase64 = null): string
    {
        $html = $this->assembler->assemble(
            html: $signingRequest->document_html,
            stage: RenderStage::Signed,
            signingRequest: $signingRequest,
            recipientSignature: $signatureBase64,
        );

        $logoFile = DocumentHtmlAssembler::resolveLogoFile($signingRequest);
        $fullHtml = $this->assembler->wrapForPdf($html, $signingRequest);

        $pdf = $this->renderPdf($fullHtml, $logoFile);

        if ($initialsBase64) {
            $pdf = $this->overlay->stamp($pdf, $initialsBase64);
        }

        return $pdf;
    }

    private function renderPdf(string $html, ?string $logoFile = null): string
    {
        return $this->pdfRenderer->render($html, new PdfRenderOptions(
            headerHtml: $this->assembler->buildHeaderHtml($logoFile),
            footerHtml: $this->assembler->buildFooterHtml(),
        ));
    }
}
