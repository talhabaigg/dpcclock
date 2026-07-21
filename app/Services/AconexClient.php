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
     * @param  bool  $includeHistory  also return superseded versions (only those
     *                                ever visible to this org — versions never
     *                                transmitted to us don't exist in our register)
     * @return array<int, array<string, mixed>> parsed documents
     */
    public function searchDocuments(string $aconexProjectId, string $searchQuery, int $resultSize = 100, bool $includeHistory = false): array
    {
        $params = [
            'search_query' => $searchQuery,
            'return_fields' => 'docno,title,doctype,discipline,fileType,author,registered,revision,filename,versionnumber',
            'search_type' => 'NUMBER_LIMITED',
            'search_result_size' => $resultSize,
        ];

        if ($includeHistory) {
            $params['show_document_history'] = 'true';
        }

        $response = Http::withToken($this->getAccessToken())
            ->withHeaders(['Accept' => 'application/xml'])
            ->get("https://{$this->instance}/api/projects/{$aconexProjectId}/register", $params);

        $response->throw();

        return $this->parseDocumentXml($response->body());
    }

    /**
     * Look up specific document numbers in the register (batched into OR
     * queries). Used to check just the drawings we've already imported for
     * newer revisions, instead of scanning the whole register.
     *
     * @param  array<int, string>  $documentNumbers
     * @return array<int, array<string, mixed>>
     */
    public function fetchByDocNumbers(string $aconexProjectId, array $documentNumbers): array
    {
        $numbers = array_values(array_unique(array_filter($documentNumbers)));
        $results = [];

        foreach (array_chunk($numbers, 40) as $chunk) {
            $query = collect($chunk)
                ->map(fn ($n) => 'docno:"'.str_replace('"', '', $n).'"')
                ->implode(' OR ');

            foreach ($this->searchDocuments($aconexProjectId, $query, 500) as $doc) {
                $results[] = $doc;
            }
        }

        return $results;
    }

    /**
     * Fetch one page of the register (server-side pagination) so large
     * registers never have to be loaded in full.
     *
     * Uses Aconex's PAGED search. Falls back to a single NUMBER_LIMITED call
     * (page 1 only) if the instance rejects PAGED, so search never hard-fails.
     *
     * @return array{documents: array<int, array<string, mixed>>, total: ?int, page: int, page_size: int, has_more: bool}
     */
    public function searchPage(string $aconexProjectId, string $searchQuery, int $page = 1, int $pageSize = 100): array
    {
        $page = max(1, $page);

        try {
            $response = Http::withToken($this->getAccessToken())
                ->withHeaders(['Accept' => 'application/xml'])
                ->get("https://{$this->instance}/api/projects/{$aconexProjectId}/register", [
                    'search_query' => $searchQuery,
                    'return_fields' => 'docno,title,doctype,discipline,fileType,author,registered,revision,filename,versionnumber',
                    'search_type' => 'PAGED',
                    'page_size' => $pageSize,
                    'page_number' => $page,
                ]);

            $response->throw();

            $parsed = trim($response->body()) === '' ? null : new SimpleXMLElement($response->body());
            $documents = $parsed ? $this->parseDocumentElements($parsed) : [];
            $total = $parsed ? $this->extractTotal($parsed) : null;

            $hasMore = $total !== null
                ? $page * $pageSize < $total
                : count($documents) >= $pageSize;

            return ['documents' => $documents, 'total' => $total, 'page' => $page, 'page_size' => $pageSize, 'has_more' => $hasMore];
        } catch (\Throwable $e) {
            Log::warning('AconexClient: paged search failed, falling back to NUMBER_LIMITED', ['error' => $e->getMessage()]);

            $documents = $this->searchDocuments($aconexProjectId, $searchQuery, 500);

            return ['documents' => $documents, 'total' => count($documents), 'page' => 1, 'page_size' => 500, 'has_more' => false];
        }
    }

    /**
     * Pull the total result count out of the register response so the UI can
     * render "page X of Y". Attribute naming varies, so probe a few names on
     * both the root and the SearchResults node; null when it can't be found.
     */
    protected function extractTotal(SimpleXMLElement $parsed): ?int
    {
        $nodes = [$parsed, $parsed->SearchResults ?? null];

        foreach (['TotalResults', 'totalResults', 'SelectedResultsCount'] as $attr) {
            foreach ($nodes as $node) {
                if ($node !== null && isset($node[$attr])) {
                    return (int) $node[$attr];
                }
            }
        }

        return null;
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

        return $this->parseDocumentElements(new SimpleXMLElement($xml));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function parseDocumentElements(SimpleXMLElement $parsed): array
    {
        $documents = [];

        foreach ($parsed->SearchResults->Document ?? [] as $doc) {
            $documents[] = [
                'aconex_document_id' => (string) $doc['DocumentId'],
                'document_number' => (string) $doc->DocumentNumber,
                'title' => (string) $doc->Title,
                'doctype' => (string) $doc->DocumentType,
                'discipline' => (string) ($doc->Discipline ?? ''),
                'file_type' => (string) $doc->FileType,
                'filename' => (string) ($doc->Filename ?? ''),
                'author' => (string) $doc->Author,
                'revision' => (string) $doc->Revision,
                'version_number' => (int) $doc->VersionNumber,
                'date_modified' => (string) $doc->DateModified,
            ];
        }

        return $documents;
    }
}
