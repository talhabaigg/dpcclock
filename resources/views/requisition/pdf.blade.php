<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <title>{{ $requisition->requisition_number }}</title>

    <style>
        .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 10px;

            box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
            font-size: 12px;
            line-height: 24px;
            font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
            color: #555;
        }

        .invoice-box table {
            width: 100%;
            line-height: inherit;
            text-align: left;
        }

        .invoice-box table td {
            padding: 5px;
            vertical-align: top;
        }

        .invoice-box table tr td:nth-child(2) {
            text-align: right;
        }

        .invoice-box table tr.top table td {
            padding-bottom: 20px;
        }

        .invoice-box table tr.top table td.title {
            font-size: 45px;
            line-height: 45px;
            color: #333;
        }

        .invoice-box table tr.information table td {
            padding-bottom: 40px;
        }

        .invoice-box table tr.heading td {
            background: #eee;
            border-bottom: 1px solid #ddd;
            font-weight: bold;
        }

        .invoice-box table tr.details td {
            padding-bottom: 20px;
        }

        .invoice-box table tr.item td {
            border-bottom: 1px solid #eee;
        }

        .invoice-box table tr.item.last td {
            border-bottom: none;
        }

        .invoice-box table tr.total td:nth-child(2) {
            border-top: 2px solid #eee;
            font-weight: bold;
        }

        @media only screen and (max-width: 600px) {
            .invoice-box table tr.top table td {
                width: 100%;
                display: block;
                text-align: center;
            }

            .invoice-box table tr.information table td {
                width: 100%;
                display: block;
                text-align: center;
            }
        }

        /** RTL **/
        .invoice-box.rtl {
            direction: rtl;
            font-family: Tahoma, 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
        }

        .invoice-box.rtl table {
            text-align: right;
        }

        .invoice-box.rtl table tr td:nth-child(2) {
            text-align: left;
        }

        .po-number {
            font-weight: bold;
            font-size: 24px;
            color: #333;
            margin-bottom: 10px;
        }
    </style>
</head>

<body>
    <div class="invoice-box">
        <table cellpadding="0" cellspacing="0">
            <tr class="top">
                <td colspan="2">
                    <table>
                        <tr>
                            <td class="title">

                                <img src="{{ public_path('logo.png') }}" alt="Logo" class="logo"
                                    style="width: 100%; max-width: 150px">

                            </td>

                            <td>
                                <div class="po-number">
                                    PO{{ $requisition->po_number }}
                                </div>


                                Required:
                                {{ \Carbon\Carbon::parse($requisition->date_required)->format('d/m/Y') }}<br />
                                Requested: {{ \Carbon\Carbon::parse($requisition->created_at)->format('d/m/Y') }}<br />
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr class="information">
                <td colspan="2">
                    <table>

                        <tr>
                            <td>
                                Job Name: {{ $requisition->location->name }}<br />
                                Job Number: {{ $requisition->location->external_id }}<br />

                            </td>

                            <td>
                                Supplier: {{ $requisition->supplier->name }}<br />
                                {{ $requisition->delivery_contact ?? 'Delivery contact:' . $requisition->delivery_contact }}<br />
                                {{ $requisition->pickup_by ?? 'Pickup by:' . $requisition->pickup_by }}<br />
                                {{ $requisition->requested_by ?? 'Requested by:' . $requisition->requested_by }}<br />
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr class="heading">
                <td>Delivery address & Instructions: </br>
                </td>

                <td></td>
            </tr>

            <tr class="details">
                <td> {{ $requisition->deliver_to }} {{ $requisition->order_reference }}</td>


            </tr>

            <tr class="heading">
                <td>Code/Description</td>

                <td>Qty</td>
            </tr>
            @php
                // Group line items by deliver_to
                $groupedItems = $requisition->lineItems->groupBy(function($item) {
                    return $item->deliver_to ?: 'No Location Specified';
                });

                // Sort groups by minimum serial_number of items in each group
                $sortedGroups = $groupedItems->map(function($items) {
                    // Sort items within each group by serial_number
                    return $items->sortBy('serial_number');
                })->sortBy(function($items) {
                    // Sort groups by minimum serial_number
                    return $items->min('serial_number') ?? PHP_INT_MAX;
                });
            @endphp

            @foreach ($sortedGroups as $location => $items)
                {{-- Delivery location header - skip for ungrouped items --}}
                @if($location !== 'No Location Specified')
                <tr class="heading">
                    <td colspan="2" style="background-color: #f1f1f1; padding: 8px; font-weight: bold;">
                        Pack these items for delivery to {{ $location }}
                    </td>
                </tr>
                @endif
                {{-- Items for this location --}}
                @foreach ($items as $line)
                    <tr class="item">
                        <td>{{ $line['code'] }}-
                            {{ $line['description'] }}</td>

                        <td>{{ number_format($line['qty'], 2) }}</td>
                    </tr>
                @endforeach
            @endforeach



        </table>
    </div>
</body>

</html>
