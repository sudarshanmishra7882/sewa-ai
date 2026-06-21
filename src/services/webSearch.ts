// Sewa AI – no-key web search service.
// Browser-only search is best-effort because many search engines block CORS.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  isOfficial: boolean;
}

export interface SearchDecision {
  needsSearch: boolean;
  reason: string;
  query: string;
}

const OFFICIAL_DOMAINS = [
  'gov.np',
  'nepal.gov.np',
  'nepalpolice.gov.np',
  'nrb.org.np',
  'ird.gov.np',
  'mof.gov.np',
  'mofa.gov.np',
  'mohp.gov.np',
  'moe.gov.np',
  'molt.gov.np',
  'dop.gov.np',
  'nta.gov.np',
  'noc.org.np',
  'sebon.gov.np',
  'beema.gov.np',
  'socialsecurity.gov.np',
  'election.gov.np',
  'supremecourt.gov.np',
  'lawcommission.gov.np',
  'nepalbar.org',
  'fncci.org',
  'nepalchamber.org',
  'who.int',
  'un.org',
  'worldbank.org',
];

const REALTIME_KEYWORDS = [
  'current', 'latest', 'recent', 'today', 'now', 'update', 'news',
  'price', 'fee', 'cost', 'rate', 'deadline', 'last date', 'exam date',
  'form deadline', 'registration', 'apply', 'requirement', 'process',
  'procedure', 'how to', 'where to', 'office', 'government', 'citizenship',
  'passport', 'license', 'driving license', 'nagarikta', 'rahadani', 'tax',
  'vat', 'pan', 'company register', 'lok sewa', 'loksewa', 'psc',
  'public service', 'constitution', 'law', 'act', 'rule', 'regulation',
  'policy', 'cybersecurity', 'scam', 'fraud', 'bank', 'nrb', 'technology',
  'ai', 'artificial intelligence', 'statistics', 'gdp', 'inflation',
  'market', 'stock', 'share', 'mero share', 'ipo',
];

const NEPALI_REALTIME_KEYWORDS = [
  'आज', 'अहिले', 'हाल', 'नयाँ', 'ताजा', 'समाचार', 'अपडेट', 'मूल्य', 'शुल्क',
  'दर', 'कति', 'कहिले', 'कहाँ', 'कसरी', 'आवेदन', 'फारम', 'म्याद', 'पासपोर्ट',
  'राहदानी', 'नागरिकता', 'लाइसेन्स', 'लोकसेवा', 'कानून', 'नियम', 'कर', 'भ्याट',
  'प्यान', 'बैंक', 'सेयर', 'आईपीओ', 'नेपाल',
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - 0x0960));
}

export function shouldSearchWeb(query: string, mode: string): SearchDecision {
  const normalized = normalizeText(query);
  const modeBoost = mode === 'legal' || mode === 'document' || mode === 'scam';
  const matchedKeywords = REALTIME_KEYWORDS.filter((kw) => normalized.includes(kw));
  const matchedNepaliKeywords = NEPALI_REALTIME_KEYWORDS.filter((kw) => query.includes(kw));
  const hasNepali = /[\u0900-\u097F]/.test(query);
  const hasYear = /\b20[2-9][0-9]\b/.test(normalized) || /\b20[8-9][0-9]\b/.test(normalized);
  const questionWords = ['what is', 'what are', 'how much', 'how many', 'when is', 'where is', 'who is', 'current', 'latest', 'today'];
  const hasQuestionWord = questionWords.some((q) => normalized.startsWith(q) || normalized.includes(q));
  const score = matchedKeywords.length + matchedNepaliKeywords.length + (hasYear ? 2 : 0) + (hasQuestionWord ? 1 : 0) + (modeBoost ? 2 : 0);
  const needsSearch = hasNepali || score >= 1;

  let searchQuery = query;
  if (
    normalized.includes('nepal') ||
    hasNepali ||
    matchedKeywords.some((k) => ['citizenship', 'passport', 'nagarikta', 'rahadani', 'loksewa', 'lok sewa'].includes(k))
  ) {
    if (!normalized.includes('nepal')) {
      searchQuery = `${query} Nepal`;
    }
  }

  return {
    needsSearch,
    reason: needsSearch
      ? `Detected ${matchedKeywords.length > 0 ? `topics: ${matchedKeywords.slice(0, 4).join(', ')}` : 'current/time-sensitive information request'}`
      : 'Question can be answered from general knowledge',
    query: searchQuery.slice(0, 200),
  };
}

function isOfficialSource(url: string): boolean {
  const lower = url.toLowerCase();
  return OFFICIAL_DOMAINS.some((domain) => lower.includes(domain));
}

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  try {
    const proxyResults = await searchViaLocalProxy(query, true);
    if (proxyResults.length > 0) return proxyResults;
  } catch (err) {
    console.warn('Local search proxy failed:', err);
  }

  try {
    const proxyResults = await searchViaLocalProxy(query, false);
    if (proxyResults.length > 0) return proxyResults;
  } catch (err) {
    console.warn('Fallback local search proxy failed:', err);
  }

  try {
    const officialResults = await searchDuckDuckGo(`${query} site:gov.np OR site:org.np`);
    if (officialResults.length > 0) return officialResults;
  } catch (err) {
    console.warn('Official web search failed:', err);
  }

  try {
    return await searchDuckDuckGo(query);
  } catch (err) {
    console.warn('DuckDuckGo search failed:', err);
  }

  return [];
}

async function searchViaLocalProxy(query: string, officialOnly: boolean): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: query, official: officialOnly ? '1' : '0' });
  const response = await fetch(`/api/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return [];

  const data = await response.json();
  if (!Array.isArray(data?.results)) return [];

  return data.results
    .filter((result: Partial<WebSearchResult>) => result.title && result.url)
    .map((result: Partial<WebSearchResult>) => ({
      title: String(result.title),
      url: String(result.url),
      snippet: String(result.snippet || ''),
      source: String(result.source || getHostname(String(result.url))),
      isOfficial: Boolean(result.isOfficial || isOfficialSource(String(result.url))),
    }));
}

async function searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  const response = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }
  );

  if (!response.ok) return [];

  const html = await response.text();
  return parseDuckDuckGoResults(html);
}

function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let match;

  while ((match = resultRegex.exec(html)) !== null) {
    const href = match[1];
    const titleHtml = match[2];
    const title = titleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const snippetStart = html.indexOf(match[0]) + match[0].length;
    const snippetChunk = html.substring(snippetStart, snippetStart + 1000);
    const snippetMatch = snippetChunk.match(/<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    let url = href;
    if (href.includes('duckduckgo.com/l/')) {
      const uMatch = href.match(/[?&]uddg=([^&]+)/);
      if (uMatch) {
        try {
          url = decodeURIComponent(uMatch[1]);
        } catch {
          url = href;
        }
      }
    }

    if (url && title && !url.includes('duckduckgo.com')) {
      results.push({
        title,
        url,
        snippet,
        source: getHostname(url),
        isOfficial: isOfficialSource(url),
      });
    }
  }

  return results;
}

export function formatSearchResultsForPrompt(results: WebSearchResult[]): string {
  if (results.length === 0) return '';

  const officialResults = results.filter((r) => r.isOfficial);
  const otherResults = results.filter((r) => !r.isOfficial);
  const bestResults = [...officialResults, ...otherResults].slice(0, 5);

  const parts = bestResults.map((r, i) => {
    return `REF-SRC-${i + 1}\nTitle: ${r.title}\nDomain: ${r.source}${r.isOfficial ? ' (Official)' : ''}\nURL: ${r.url}\nContent: ${r.snippet}`;
  });

  return `\n\n--- REAL-TIME WEB SEARCH RESULTS ---\n${parts.join('\n\n')}\n--- END SEARCH RESULTS ---\n\nUse the above sources to answer accurately. Prefer official sources. Do NOT include any [1], [2], citation markers, or numbered references in your answer. Just write naturally. The full source list will be shown to the user separately below your response.`;
}

export function formatCitations(results: WebSearchResult[]): string {
  if (results.length === 0) return '';

  const officialResults = results.filter((r) => r.isOfficial);
  const otherResults = results.filter((r) => !r.isOfficial);
  const bestResults = [...officialResults, ...otherResults].slice(0, 5);

  return (
    '\n\n---\n\n**Sources:**\n' +
    bestResults
      .map((r, i) => `${i + 1}. [${r.source}${r.isOfficial ? ' ☑️ Official' : ''}](${r.url}) — ${r.title}`)
      .join('\n')
  );
}
