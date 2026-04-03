<?php

namespace App\Services;

use App\Models\Location;
use Spatie\Browsershot\Browsershot;

class ProjectReportPdfService
{
    public function generate(Location $location, array $reportData): string
    {
        $html = view('reports.project-report', [
            'location' => $location,
            'logoBase64' => $this->getLogoBase64(),
            'timelineData' => $reportData['timelineData'] ?? null,
            'asOfDate' => $reportData['asOfDate'] ?? null,
            'claimedToDate' => $reportData['claimedToDate'] ?? null,
            'cashRetention' => $reportData['cashRetention'] ?? null,
            'projectIncomeData' => $reportData['projectIncomeData'] ?? [
                'originalContractSum' => ['income' => 0, 'cost' => 0, 'profit' => 0, 'profitPercent' => 0],
                'currentContractSum' => ['income' => 0, 'cost' => 0, 'profit' => 0, 'profitPercent' => 0],
                'thisMonth' => ['income' => 0, 'cost' => 0, 'profit' => 0, 'profitPercent' => 0],
                'previousMonth' => ['income' => 0, 'cost' => 0, 'profit' => 0, 'profitPercent' => 0],
                'projectToDate' => ['income' => 0, 'cost' => 0, 'profit' => 0, 'profitPercent' => 0],
                'remainingBalance' => ['income' => 0, 'cost' => 0, 'profit' => 0, 'profitPercent' => 0],
            ],
            'variationsSummary' => $reportData['variationsSummary'] ?? [],
            'labourBudgetData' => $reportData['labourBudgetData'] ?? [],
            'vendorCommitmentsSummary' => $reportData['vendorCommitmentsSummary'] ?? null,
            'employeesOnSite' => $reportData['employeesOnSite'] ?? null,
            'productionCostCodes' => $reportData['productionCostCodes'] ?? null,
            'industrialActionHours' => $reportData['industrialActionHours'] ?? 0,
            'dpcPercentComplete' => $reportData['dpcPercentComplete'] ?? null,
        ])->render();

        return $this->renderWithBrowsershot($html, $location->name, $reportData['asOfDate'] ?? null);
    }

    private function renderWithBrowsershot(string $html, string $projectName, ?string $asOfDate): string
    {
        $logoBase64 = $this->getLogoBase64();
        $dateStr = $asOfDate ? \Carbon\Carbon::parse($asOfDate)->format('d M Y') : now()->format('d M Y');

        $headerHtml = <<<HEADER
        <div style="width: 100%; padding: 8px 15mm 6px;">
            <div style="display: flex; align-items: center; padding-bottom: 6px; border-bottom: 2px solid #334155;">
                <div style="flex: 0 0 80px;">
                    <img src="{$logoBase64}" style="max-height: 32px;" />
                </div>
                <div style="flex: 1; text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #334155; font-weight: 600;">
                    Monthly Project Report &mdash; {$projectName}
                </div>
                <div style="flex: 0 0 80px; text-align: right; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #64748b;">
                    {$dateStr}
                </div>
            </div>
        </div>
        HEADER;

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 15mm 6px;">
            <div style="display: flex; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #6b7280; padding-top: 6px; border-top: 2px solid #334155;">
                <div style="flex: 1; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #334155;">Private &amp; Confidential</div>
                <div style="flex: 1; text-align: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
        </div>
        FOOTER;

        $browsershot = Browsershot::html($html);

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
            ->margins(30, 15, 20, 15, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();
    }

    private function getLogoBase64(): string
    {
        $logoPath = public_path('logo.png');
        if (!file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoData = base64_encode(file_get_contents($logoPath));

        return 'data:image/png;base64,' . $logoData;
    }
}
