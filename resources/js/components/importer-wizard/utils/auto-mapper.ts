import type { AutoMapResult, ImporterColumnDef } from '../types';

/** Normalize a string for comparison: lowercase, replace separators with spaces, collapse whitespace */
function normalize(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/[_\-.\s]+/g, ' ')
        .trim();
}

/** Get the set of character bigrams from a string */
function bigrams(str: string): Set<string> {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
        s.add(str.slice(i, i + 2));
    }
    return s;
}

/** Dice coefficient similarity between two strings (0 to 1) */
function diceCoefficient(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramsA = bigrams(a);
    const bigramsB = bigrams(b);
    let intersection = 0;

    for (const bg of bigramsA) {
        if (bigramsB.has(bg)) intersection++;
    }

    return (2 * intersection) / (bigramsA.size + bigramsB.size) || 0;
}

/** Compute similarity between a target column and a source header */
function computeSimilarity(target: ImporterColumnDef, sourceHeader: string): { score: number; method: 'exact' | 'alias' | 'fuzzy' } {
    const normalizedSource = normalize(sourceHeader);
    const normalizedKey = normalize(target.key);
    const normalizedLabel = normalize(target.label);

    // Exact match on key or label
    if (normalizedSource === normalizedKey || normalizedSource === normalizedLabel) {
        return { score: 1.0, method: 'exact' };
    }

    // Alias match
    if (target.aliases) {
        for (const alias of target.aliases) {
            if (normalize(alias) === normalizedSource) {
                return { score: 0.95, method: 'alias' };
            }
        }
    }

    // Fuzzy matching - best score across key, label, and aliases
    const candidates = [normalizedKey, normalizedLabel, ...(target.aliases?.map(normalize) ?? [])];
    let bestScore = 0;

    for (const candidate of candidates) {
        let score = diceCoefficient(candidate, normalizedSource);

        // Boost if one contains the other
        if (normalizedSource.includes(candidate) || candidate.includes(normalizedSource)) {
            score = Math.min(score + 0.2, 0.94); // Cap below alias match
        }

        bestScore = Math.max(bestScore, score);
    }

    return { score: bestScore, method: 'fuzzy' };
}

/**
 * Auto-map source file headers to target column definitions.
 * Each source header is used at most once. Greedy highest-confidence-first.
 */
export function autoMapColumns(targetColumns: ImporterColumnDef[], sourceHeaders: string[]): AutoMapResult {
    // Compute all pairwise scores
    const candidates: { targetKey: string; sourceHeader: string; score: number; method: 'exact' | 'alias' | 'fuzzy' }[] = [];

    for (const target of targetColumns) {
        for (const source of sourceHeaders) {
            const { score, method } = computeSimilarity(target, source);
            if (score >= 0.6) {
                candidates.push({ targetKey: target.key, sourceHeader: source, score, method });
            }
        }
    }

    // Sort by score descending, then prefer exact > alias > fuzzy
    const methodPriority = { exact: 3, alias: 2, fuzzy: 1 };
    candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return methodPriority[b.method] - methodPriority[a.method];
    });

    // Greedy assignment - each target and source used at most once
    const mapping: Record<string, string> = {};
    const confidence: Record<string, { score: number; method: 'exact' | 'alias' | 'fuzzy' }> = {};
    const usedSources = new Set<string>();
    const usedTargets = new Set<string>();

    for (const candidate of candidates) {
        if (usedTargets.has(candidate.targetKey) || usedSources.has(candidate.sourceHeader)) {
            continue;
        }
        mapping[candidate.targetKey] = candidate.sourceHeader;
        confidence[candidate.targetKey] = { score: candidate.score, method: candidate.method };
        usedTargets.add(candidate.targetKey);
        usedSources.add(candidate.sourceHeader);
    }

    return { mapping, confidence };
}
