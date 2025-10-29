<?php
namespace App\Services;

use Http;
class VariationService
{
    public function getChangeOrders($location, $companyId, $token)
    {

        $queryParams = [
            'parameter.company' => $companyId,
            'parameter.job' => $location->external_id,
            'parameter.pageSize' => 1000,
        ];
        $base_url = env('PREMIER_SWAGGER_API_URL');
        $response = Http::withToken($token)
            ->acceptJson()
            ->get($base_url . '/api/ChangeOrder/GetChangeOrders', $queryParams);
        return $response;
    }

    public function getChangeOrderLines($changeOrderId, $companyId, $token)
    {
        $queryParams = [
            'parameter.company' => $companyId,
            'parameter.changeOrder' => $changeOrderId,
        ];
        $base_url = env('PREMIER_SWAGGER_API_URL');
        $response = Http::withToken($token)
            ->acceptJson()
            ->get($base_url . '/api/ChangeOrder/GetChangeOrderLines', $queryParams);
        return $response;
    }
}