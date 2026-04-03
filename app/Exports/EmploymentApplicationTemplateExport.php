<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class EmploymentApplicationTemplateExport implements FromArray, ShouldAutoSize, WithStyles
{
    public function array(): array
    {
        return [
            // Header row
            [
                'First Name *',
                'Surname *',
                'Email *',
                'Phone *',
                'Suburb *',
                'Date of Birth *',
                'Occupation *',
                'Occupation Other',
                'Apprentice Year',
                'Trade Qualified',
                'Preferred Project Site',
                'Why Should We Employ You *',
                'Referred By',
                'Aboriginal or TSI',
                'Safety Induction Number *',
                'EWP Below 11m',
                'EWP Above 11m',
                'Forklift Licence Number',
                'Work Safely at Heights *',
                'Scaffold Licence Number',
                'First Aid Completion Date',
                'Workplace Impairment Training *',
                'WIT Completion Date',
                'Asbestos Awareness Training *',
                'Crystalline Silica Course *',
                'Gender Equity Training *',
                'Quantitative Fit Test *',
                'Workcover Claim',
                'Medical Condition',
                'Medical Condition Other',
                'Skills',
                'Status',
                // Reference 1
                'Ref 1 Company *',
                'Ref 1 Position *',
                'Ref 1 Employment Period *',
                'Ref 1 Contact Person *',
                'Ref 1 Phone *',
                // Reference 2
                'Ref 2 Company *',
                'Ref 2 Position *',
                'Ref 2 Employment Period *',
                'Ref 2 Contact Person *',
                'Ref 2 Phone *',
                // Reference 3
                'Ref 3 Company',
                'Ref 3 Position',
                'Ref 3 Employment Period',
                'Ref 3 Contact Person',
                'Ref 3 Phone',
            ],
            // Example row
            [
                'John',
                'Smith',
                'john.smith@example.com',
                '0412345678',
                'Sydney',
                '1990-01-15',
                'plasterer',
                '',
                '',
                'Yes',
                'CBD Project',
                'I have 10 years of experience in plastering.',
                'Jane Doe',
                'No',
                'SI-12345',
                'Yes',
                'No',
                '',
                'Yes',
                '',
                '2025-06-01',
                'Yes',
                '2025-03-15',
                'Yes',
                'Yes',
                'Yes',
                'quantitative',
                'No',
                '',
                '',
                'Plastering, Rendering, Scaffolding',
                'new',
                // Reference 1
                'ABC Plastering',
                'Senior Plasterer',
                '2018-2023',
                'Bob Jones',
                '0498765432',
                // Reference 2
                'XYZ Construction',
                'Plasterer',
                '2015-2018',
                'Mary Brown',
                '0487654321',
                // Reference 3
                '',
                '',
                '',
                '',
                '',
            ],
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        $lastCol = 'AU';

        // Header row styling
        $sheet->getStyle("A1:{$lastCol}1")->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['argb' => 'FFFFFFFF'],
                'size' => 10,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FF2563EB'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
        ]);

        // Example row styling (light grey background)
        $sheet->getStyle("A2:{$lastCol}2")->applyFromArray([
            'font' => [
                'italic' => true,
                'color' => ['argb' => 'FF6B7280'],
                'size' => 9,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FFF3F4F6'],
            ],
        ]);

        $sheet->setAutoFilter("A1:{$lastCol}1");
        $sheet->getRowDimension(1)->setRowHeight(30);

        return [];
    }
}
