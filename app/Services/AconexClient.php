<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use SimpleXMLElement;

/**
 * Thin client for the Aconex / Oracle Smart Construction Platform REST API.
 *
 * Auth: OAuth2 client_credentials grant against the Oracle Lobby, using a
 * "User-Bound Integration" OAuth client (see config/services.php + .env).
 * Tokens last 1 hour and are cached accordingly.
 *
 * Note on response formats: endpoints default to XML; /api/projects supports
 * JSON only when Accept: application/json is sent, while the Documents
 * register endpoint (/api/projects/{id}/register) only returns XML.
 */
class AconexClient
{
    protected string $clientId;

    protected string $clientSecret;

    protected string $lobbyUrl;

    protected string $instance;

    public function __construct()
    {
        $this->clientId = (string) config('services.aconex.client_id');
        $this->clientSecret = (string) config('services.aconex.client_secret');
        $this->lobbyUrl = (string) config('services.aconex.lobby_url');
        $this->instance = (string) config('services.aconex.instance');
    }

    public function isConfigured(): bool
    {
        return $this->clientId !== '' && $this->clientSecret !== '';
    }

    /**
     * Get a cached bearer token, requesting a new one if expired/missing.
     * Tokens last 1 hour; cached for 55 minutes to leave margin.
     */
    public function getAccessToken(): string
    {
        return Cache::remember('aconex_access_token', now()->addMinutes(55), function () {
            $response = Http::asForm()
                ->withBasicAuth($this->clientId, $this->clientSecret)
                ->post("{$this->lobbyUrl}/auth/token", [
                    'grant_type' => 'client_credentials',
                ]);

            if ($response->failed()) {
                Log::error('AconexClient: token request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                throw new RuntimeException('Aconex authentication failed: '.$response->body());
            }

            $token = $response->json('access_token');

            if (! $token) {
                throw new RuntimeException('Aconex authentication response did not include an access token.');
            }

            return $token;
        });
    }

    /**
     * List all Aconex projects visible to the bound user.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listProjects(): array
    {
        $response = Http::withToken($this->getAccessToken())
            ->acceptJson()
            ->get("https://{$this->instance}/api/projects");

        $response->throw();

        return $response->json('searchResults', []);
    }

    /**
     * Search the document register for a given Aconex project.
     *
     * @param  string  $aconexProjectId  the Aconex project ID (not the local Location id)
     * @param  string  $searchQuery  plain keyword or Lucene-style query, e.g. doctype:"Drawing" AND partition
     * @param  int  $resultSize  max results in one call (NUMBER_LIMITED search)
     * @return array<int, array<string, mixed>> parsed documents
     */
    public function searchDocuments(string $aconexProjectId, string $searchQuery, int $resultSize = 100): array
    {
        $response = Http::withToken($this->getAccessToken())
            ->withHeaders(['Accept' => 'application/xml'])
            ->get("https://{$this->instance}/api/projects/{$aconexProjectId}/register", [
                'search_query' => $searchQuery,
                'return_fields' => 'docno,title,doctype,fileType,author,registered,revision,filename',
                'search_type' => 'NUMBER_LIMITED',
                'search_result_size' => $resultSize,
            ]);

        $response->throw();

        return $this->parseDocumentXml($response->body());
    }

    /**
     * Download the raw file bytes for a specific Aconex document.
     *
     * @return array{contents: string, filename: string, mime: ?string}
     */
    public function downloadDocument(string $aconexProjectId, string $documentId): array
    {
        $response = Http::withToken($this->getAccessToken())
            ->get("https://{$this->instance}/api/projects/{$aconexProjectId}/register/{$documentId}");

        $response->throw();

        $contentDisposition = $response->header('Content-Disposition');
        $filename = $this->extractFilename($contentDisposition) ?? "aconex-document-{$documentId}";

        return [
            'contents' => $response->body(),
            'filename' => $filename,
            'mime' => $response->header('Content-Type'),
        ];
    }

    protected function extractFilename(?string $contentDisposition): ?string
    {
        if (! $contentDisposition) {
            return null;
        }

        if (preg_match('/filename\*?=(?:UTF-8\'\')?"?([^";]+)"?/i', $contentDisposition, $matches)) {
            return rawurldecode(trim($matches[1]));
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function parseDocumentXml(string $xml): array
    {
        if (trim($xml) === '') {
            return [];
        }

        $parsed = new SimpleXMLElement($xml);
        $documents = [];

        foreach ($parsed->SearchResults->Document ?? [] as $doc) {
            $documents[] = [
                'aconex_document_id' => (string) $doc['DocumentId'],
                'document_number' => (string) $doc->DocumentNumber,
                'title' => (string) $doc->Title,
                'doctype' => (string) $doc->DocumentType,
                'file_type' => (string) $doc->FileType,
                'filename' => (string) ($doc->Filename ?? ''),
                'author' => (string) $doc->Author,
                'revision' => (string) $doc->Revision,
                'date_modified' => (string) $doc->DateModified,
            ];
        }

        return $documents;
    }
}
