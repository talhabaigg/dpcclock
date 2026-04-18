<?php

namespace App\Services;

use App\Models\Drawing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Drawing processing orchestrator.
 *
 * File storage is handled by Spatie MediaLibrary. This service generates
 * a PNG thumbnail from the uploaded source (PDF or image) and stores it
 * in the `thumbnail` media collection. Spatie v11 can't render PDFs
 * natively, so we run the conversion ourselves using Imagick/pdftoppm/gs.
 */
class DrawingProcessingService
{
    public function processDrawing(Drawing $drawing): array
    {
        try {
            $drawing->update(['status' => Drawing::STATUS_PROCESSING]);

            $this->generateThumbnail($drawing);

            $drawing->update(['status' => Drawing::STATUS_ACTIVE]);

            return ['success' => true];
        } catch (\Exception $e) {
            Log::error('Drawing processing failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            $drawing->update(['status' => Drawing::STATUS_DRAFT]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    protected function generateThumbnail(Drawing $drawing): void
    {
        $source = $drawing->getFirstMedia('source');
        if (! $source) {
            return;
        }

        $sourcePath = $this->resolveLocalSourcePath($source);
        if (! $sourcePath) {
            Log::warning('Drawing thumbnail: could not resolve source path', ['drawing_id' => $drawing->id]);

            return;
        }

        $tempThumb = sys_get_temp_dir().'/drawing_thumb_'.$drawing->id.'_'.uniqid().'.png';
        $ext = Str::lower(pathinfo($source->file_name, PATHINFO_EXTENSION));
        $isPdf = $ext === 'pdf' || str_contains(strtolower($source->mime_type ?? ''), 'pdf');

        $success = $isPdf
            ? $this->pdfToImage($sourcePath, $tempThumb, 1200)
            : $this->resizeImage($sourcePath, $tempThumb, 1200);

        if (! $success || ! file_exists($tempThumb)) {
            Log::warning('Drawing thumbnail generation failed', [
                'drawing_id' => $drawing->id,
                'source' => $source->file_name,
            ]);
            @unlink($tempThumb);

            return;
        }

        $drawing->addMedia($tempThumb)
            ->usingFileName("drawing_{$drawing->id}_thumb.png")
            ->toMediaCollection('thumbnail');

        // Spatie moves the file; no need to unlink.
    }

    /**
     * Get a local filesystem path for the source media. Downloads from S3 if needed.
     */
    protected function resolveLocalSourcePath($media): ?string
    {
        if ($media->disk !== 's3') {
            $path = $media->getPath();

            return file_exists($path) ? $path : null;
        }

        try {
            $ext = pathinfo($media->file_name, PATHINFO_EXTENSION) ?: 'pdf';
            $tempPath = sys_get_temp_dir().'/drawing_src_'.md5($media->id).'_'.uniqid().'.'.$ext;
            $content = Storage::disk($media->disk)->get($media->getPathRelativeToRoot());
            if ($content) {
                file_put_contents($tempPath, $content);

                return $tempPath;
            }
        } catch (\Exception $e) {
            Log::error('Failed to download source from S3', ['media_id' => $media->id, 'error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Convert a PDF's first page to a PNG image using whichever tool is available.
     */
    protected function pdfToImage(string $pdfPath, string $outputPath, int $maxWidth = 1200): bool
    {
        $dpi = $maxWidth >= 1000 ? 200 : 150;

        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick;
                $imagick->setResolution($dpi, $dpi);
                $imagick->readImage($pdfPath.'[0]');
                $imagick->setImageBackgroundColor('white');
                $imagick->setImageAlphaChannel(\Imagick::ALPHACHANNEL_REMOVE);
                $imagick->setImageFormat('png');
                $imagick->thumbnailImage($maxWidth, 0);
                $imagick->writeImage($outputPath);
                $imagick->clear();
                $imagick->destroy();

                return true;
            } catch (\Exception $e) {
                Log::debug('Imagick PDF conversion failed', ['error' => $e->getMessage()]);
            }
        }

        $pdftoppm = $this->findExecutable(['pdftoppm']);
        if ($pdftoppm) {
            $tempBase = sys_get_temp_dir().'/pdf_'.uniqid();
            $cmd = escapeshellarg($pdftoppm).' -png -f 1 -l 1 -scale-to '.$maxWidth.' '
                .escapeshellarg($pdfPath).' '.escapeshellarg($tempBase);
            exec($cmd.' 2>&1', $output, $returnCode);
            $tempFile = $tempBase.'-1.png';
            if ($returnCode === 0 && file_exists($tempFile)) {
                rename($tempFile, $outputPath);

                return true;
            }
            @unlink($tempFile);
        }

        $convert = $this->findExecutable(['magick', 'convert']);
        if ($convert) {
            $cmd = escapeshellarg($convert).' -density '.$dpi.' '
                .escapeshellarg($pdfPath.'[0]')
                .' -background white -alpha remove -resize '.$maxWidth.'x -quality 90 '
                .escapeshellarg($outputPath);
            exec($cmd.' 2>&1', $output, $returnCode);
            if ($returnCode === 0 && file_exists($outputPath)) {
                return true;
            }
        }

        $gs = $this->findExecutable(['gs', 'gswin64c', 'gswin32c']);
        if ($gs) {
            $cmd = escapeshellarg($gs).' -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r'.$dpi
                .' -dFirstPage=1 -dLastPage=1 '
                .'-sOutputFile='.escapeshellarg($outputPath).' '.escapeshellarg($pdfPath);
            exec($cmd.' 2>&1', $output, $returnCode);
            if ($returnCode === 0 && file_exists($outputPath)) {
                $this->resizeImage($outputPath, $outputPath, $maxWidth);

                return true;
            }
        }

        return false;
    }

    /**
     * Resize an image using GD.
     */
    protected function resizeImage(string $inputPath, string $outputPath, int $maxWidth): bool
    {
        $info = @getimagesize($inputPath);
        if (! $info) {
            return false;
        }

        [$width, $height, $type] = $info;
        $ratio = $maxWidth / $width;
        $newWidth = $maxWidth;
        $newHeight = (int) ($height * $ratio);

        $source = match ($type) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($inputPath),
            IMAGETYPE_PNG => imagecreatefrompng($inputPath),
            IMAGETYPE_GIF => imagecreatefromgif($inputPath),
            default => null,
        };
        if (! $source) {
            return false;
        }

        $resized = imagecreatetruecolor($newWidth, $newHeight);
        if ($type === IMAGETYPE_PNG) {
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        $result = imagepng($resized, $outputPath, 6);
        imagedestroy($source);
        imagedestroy($resized);

        return $result;
    }

    protected function findExecutable(array $names): ?string
    {
        $windowsPaths = [
            'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.1-Q16\\',
            'C:\\Program Files\\ImageMagick\\',
            'C:\\Program Files\\poppler\\bin\\',
            'C:\\Program Files\\poppler-24.02.0\\Library\\bin\\',
            'C:\\Program Files\\gs\\gs10.06.0\\bin\\',
            'C:\\Program Files\\gs\\gs10.02.1\\bin\\',
        ];
        $unixPaths = ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/'];
        $paths = PHP_OS_FAMILY === 'Windows' ? $windowsPaths : $unixPaths;

        foreach ($names as $name) {
            if (PHP_OS_FAMILY === 'Windows') {
                foreach ($paths as $path) {
                    $fullPath = $path.$name.'.exe';
                    if (file_exists($fullPath)) {
                        return $fullPath;
                    }
                }
            }

            $output = [];
            $which = PHP_OS_FAMILY === 'Windows' ? 'where' : 'which';
            exec("$which $name 2>&1", $output, $returnCode);
            if ($returnCode === 0 && ! empty($output[0])) {
                $foundPath = trim($output[0]);
                if (PHP_OS_FAMILY === 'Windows' && str_contains(strtolower($foundPath), 'system32')) {
                    continue;
                }
                if (! str_contains($foundPath, 'INFO:') && file_exists($foundPath)) {
                    return $foundPath;
                }
            }

            if (PHP_OS_FAMILY !== 'Windows') {
                foreach ($paths as $path) {
                    $fullPath = $path.$name;
                    if (file_exists($fullPath)) {
                        return $fullPath;
                    }
                }
            }
        }

        return null;
    }
}
