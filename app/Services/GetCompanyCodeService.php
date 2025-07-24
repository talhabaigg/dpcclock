<?php
namespace App\Services;
class GetCompanyCodeService
{
    public function getCompanyCode($id): ?string
    {
        $companyCodes = [
            '1149031' => 'SWC',
            '1198645' => 'GREEN',
            '1249093' => 'SWCP'
        ];

        return $companyCodes[$id] ?? null;
    }
}