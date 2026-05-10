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

            $this->captureSourceDimensions($drawing);
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

    /**
     * Probe a drawing's source for its native PDF user-space dimensions in points
     * (1pt = 1/72in). For PDFs, Imagick at 72 DPI gives pixels-per-point = 1, so the
     * pixel geometry equals the point geometry. For raster sources (PNG/JPG/TIFF),
     * we treat the pixel dimensions as the coordinate basis since there's no
     * intrinsic point size; this matches the OST coordinate convention used elsewhere.
     *
     * Returns [0, 0] if the source can't be located or probed.
     *
     * @return array{0: float, 1: float}
     */
    public function probePdfPointDimensions(Drawing $drawing): array
    {
        $source = $drawing->getFirstMedia('source');
        if (! $source) {
            return [0.0, 0.0];
        }

        $sourcePath = $this->resolveLocalSourcePath($source);
        if (! $sourcePath) {
            return [0.0, 0.0];
        }

        $ext = Str::lower(pathinfo($source->file_name, PATHINFO_EXTENSION));
        $isPdf = $ext === 'pdf' || str_contains(strtolower($source->mime_type ?? ''), 'pdf');

        if (! $isPdf) {
            $dims = $this->probeImageDimensions($sourcePath);
            return $dims ? [(float) $dims[0], (float) $dims[1]] : [0.0, 0.0];
        }

        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick;
                $imagick->setResolution(72, 72);
                $imagick->readImage($sourcePath.'[0]');
                $w = (float) $imagick->getImageWidth();
                $h = (float) $imagick->getImageHeight();
                $imagick->clear();
                $imagick->destroy();
                if ($w > 0 && $h > 0) {
                    return [$w, $h];
                }
            } catch (\Throwable $e) {
                Log::debug('Imagick PDF point probe failed', [
                    'drawing_id' => $drawing->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Fallback: parse `pdfinfo` output. Available alongside pdftoppm.
        $pdfinfo = $this->findExecutable(['pdfinfo']);
        if ($pdfinfo) {
            $cmd = escapeshellarg($pdfinfo).' '.escapeshellarg($sourcePath);
            exec($cmd.' 2>&1', $output, $returnCode);
            if ($returnCode === 0) {
                foreach ($output as $line) {
                    if (preg_match('/^Page size:\s*([0-9.]+)\s*x\s*([0-9.]+)\s*pts/i', $line, $m)) {
                        return [(float) $m[1], (float) $m[2]];
                    }
                }
            }
        }

        // Fallback: ImageMagick CLI. `-density 72` makes pixel dims equal PDF points
        // (1pt = 1/72in = 1px at 72dpi).
        $magick = $this->findExecutable(['magick', 'identify']);
        if ($magick) {
            $isMagick7 = str_contains(strtolower(basename($magick)), 'magick');
            $cmd = $isMagick7
                ? escapeshellarg($magick).' identify -density 72 -format "%w %h" '.escapeshellarg($sourcePath.'[0]')
                : escapeshellarg($magick).' -density 72 -format "%w %h" '.escapeshellarg($sourcePath.'[0]');
            $out = [];
            exec($cmd.' 2>&1', $out, $returnCode);
            if ($returnCode === 0 && ! empty($out)) {
                $parts = preg_split('/\s+/', trim((string) $out[0]));
                if (is_array($parts) && count($parts) >= 2 && (float) $parts[0] > 0 && (float) $parts[1] > 0) {
                    return [(float) $parts[0], (float) $parts[1]];
                }
            }
        }

        // Fallback: Ghostscript bbox device. Reports the bounding box in PDF points
        // on stderr; the high-resolution `%%HiResBoundingBox` line is most accurate.
        $gs = $this->findExecutable(['gs', 'gswin64c', 'gswin32c']);
        if ($gs) {
            $cmd = escapeshellarg($gs).' -dNOPAUSE -dBATCH -dQUIET -sDEVICE=bbox '
                .'-dFirstPage=1 -dLastPage=1 '.escapeshellarg($sourcePath);
            $out = [];
            exec($cmd.' 2>&1', $out, $returnCode);
            if ($returnCode === 0) {
                foreach ($out as $line) {
                    if (preg_match('/^%%HiResBoundingBox:\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i', $line, $m)) {
                        return [(float) $m[3] - (float) $m[1], (float) $m[4] - (float) $m[2]];
                    }
                }
                foreach ($out as $line) {
                    if (preg_match('/^%%BoundingBox:\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i', $line, $m)) {
                        return [(float) $m[3] - (float) $m[1], (float) $m[4] - (float) $m[2]];
                    }
                }
            }
        }

        return [0.0, 0.0];
    }

    /**
     * Probe the source PDF/image for its native pixel dimensions and persist them.
     * These are used by DrawingMeasurementController for normalized→real coordinate math.
     * Renders the PDF at a fixed DPI so the values are reproducible.
     */
    protected function captureSourceDimensions(Drawing $drawing): void
    {
        $source = $drawing->getFirstMedia('source');
        if (! $source) {
            return;
        }

        $sourcePath = $this->resolveLocalSourcePath($source);
        if (! $sourcePath) {
            return;
        }

        $ext = Str::lower(pathinfo($source->file_name, PATHINFO_EXTENSION));
        $isPdf = $ext === 'pdf' || str_contains(strtolower($source->mime_type ?? ''), 'pdf');

        [$width, $height] = $isPdf
            ? $this->probePdfDimensions($sourcePath)
            : ($this->probeImageDimensions($sourcePath) ?? [0, 0]);

        if ($width > 0 && $height > 0) {
            $drawing->update([
                'tiles_width' => $width,
                'tiles_height' => $height,
            ]);
        } else {
            Log::warning('Drawing dimension probe failed', [
                'drawing_id' => $drawing->id,
                'source' => $source->file_name,
            ]);
        }
    }

    /**
     * Render the PDF's first page at a fixed DPI and read its dimensions.
     * Renders to a temp PNG and reads dims via getimagesize (cheap header read).
     */
    protected function probePdfDimensions(string $pdfPath, int $dpi = 200): array
    {
        $tempPng = sys_get_temp_dir().'/drawing_dims_'.uniqid().'.png';
        try {
            if (! $this->pdfToImage($pdfPath, $tempPng, 4000)) {
                return [0, 0];
            }
            $info = @getimagesize($tempPng);
            return $info ? [$info[0], $info[1]] : [0, 0];
        } finally {
            @unlink($tempPng);
        }
    }

    protected function probeImageDimensions(string $imagePath): ?array
    {
        $info = @getimagesize($imagePath);
        return $info ? [$info[0], $info[1]] : null;
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
