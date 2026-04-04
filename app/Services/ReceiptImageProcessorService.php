<?php

namespace App\Services;

use App\Models\CreditCardReceipt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

class ReceiptImageProcessorService
{
    public function process(CreditCardReceipt $receipt): bool
    {
        $media = $receipt->getFirstMedia('receipts');

        if (! $media) {
            return false;
        }

        // Skip PDFs — can't image-process them
        if ($media->mime_type === 'application/pdf') {
            return false;
        }

        try {
            $contents = $this->getMediaContents($media);

            $manager = new ImageManager(new Driver);
            $image = $manager->read($contents);

            // 1. Convert to grayscale for cleaner look
            $image->greyscale();

            // 2. Increase contrast to push bg towards white, text towards black
            $image->contrast(40);

            // 3. Bump brightness to bleach out background noise
            $image->brightness(15);

            // 4. Apply another round of contrast for crisp text
            $image->contrast(30);

            // 5. Sharpen to improve text edges
            $image->sharpen(15);

            $encoded = $image->toPng();

            // Store processed image as a temp file and add to media collection
            $tempPath = tempnam(sys_get_temp_dir(), 'receipt_processed_');
            $tempFile = $tempPath.'.png';
            file_put_contents($tempFile, $encoded->toString());

            // Remove old processed image if exists
            $receipt->clearMediaCollection('processed_receipts');

            $receipt->addMedia($tempFile)
                ->usingFileName('processed_'.pathinfo($media->file_name, PATHINFO_FILENAME).'.png')
                ->toMediaCollection('processed_receipts');

            // Clean up temp file (addMedia moves it, but just in case)
            @unlink($tempPath);

            return true;
        } catch (\Throwable $e) {
            Log::warning('Receipt image processing failed', [
                'receipt_id' => $receipt->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function getMediaContents($media): string
    {
        if ($media->disk === 's3') {
            return Storage::disk('s3')->get($media->getPathRelativeToRoot());
        }

        return file_get_contents($media->getPath());
    }
}
