import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  isOfficial: boolean;
}

const OFFICIAL_DOMAINS = [
  "gov.np",
  "nepal.gov.np",
  "nepalpolice.gov.np",
  "nrb.org.np",
  "ird.gov.np",
  "mof.gov.np",
  "mofa.gov.np",
  "mohp.gov.np",
  "dop.gov.np",
  "nta.gov.np",
  "lawcommission.gov.np",
  "who.int",
  "un.org",
  "worldbank.org",
];

function isOfficialSource(url: string): boolean {
  const lower = url.toLowerCase();
  return OFFICIAL_DOMAINS.some((domain) => lower.includes(domain));
}

function getHostname(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = resultRegex.exec(html)) !== null) {
    const href = decodeHtml(match[1]);
    const title = stripHtml(match[2]);
    const snippetStart = html.indexOf(match[0]) + match[0].length;
    const snippetChunk = html.substring(snippetStart, snippetStart + 1200);
    const snippetMatch = snippetChunk.match(/<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";

    let url = href;
    if (href.includes("duckduckgo.com/l/")) {
      const uMatch = href.match(/[?&]uddg=([^&]+)/);
      if (uMatch) {
        try {
          url = decodeURIComponent(uMatch[1]);
        } catch {
          url = href;
        }
      }
    }

    if (url && title && !url.includes("duckduckgo.com")) {
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

async function fetchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) return [];
  return parseDuckDuckGoResults(await response.text());
}

function noKeySearchPlugin(): Plugin {
  const searchMiddleware: NonNullable<Parameters<NonNullable<Plugin["configureServer"]>>[0]["middlewares"]>["use"] extends (path: string, handler: infer H) => unknown ? H : never = async (req, res) => {
    const requestUrl = new URL(req.url || "", "http://localhost");
    const query = requestUrl.searchParams.get("q")?.trim();
    const officialOnly = requestUrl.searchParams.get("official") === "1";

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (!query) {
      res.statusCode = 400;
      res.end(JSON.stringify({ results: [] }));
      return;
    }

    try {
      const official = officialOnly ? await fetchDuckDuckGo(`${query} site:gov.np OR site:org.np`) : [];
      const general = officialOnly ? [] : await fetchDuckDuckGo(query);
      const results = [...official, ...general].slice(0, 8);
      res.end(JSON.stringify({ results }));
    } catch (error) {
      res.end(JSON.stringify({ results: [] }));
    }
  };

  return {
    name: "sewa-no-key-web-search",
    configureServer(server) {
      server.middlewares.use("/api/search", searchMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/search", searchMiddleware);
    },
  };
}

function aiProxyPlugin(): Plugin {
  const env = loadEnv("", process.cwd(), "");
  const apiKey = env.AGENT_ROUTER_API_KEY;
  const targetUrl = env.AGENT_ROUTER_TARGET_URL || "https://agentrouter.org/v1/chat/completions";
  const model = env.AGENT_ROUTER_MODEL || "gpt-5.5";

  const chatMiddleware: NonNullable<Parameters<NonNullable<Plugin["configureServer"]>>[0]["middlewares"]>["use"] extends (path: string, handler: infer H) => unknown ? H : never = async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Missing AGENT_ROUTER_API_KEY on the server" }));
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const upstreamResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Originator: "codex_cli_rs",
          "User-Agent": "codex_cli_rs/0.101.0",
          Version: "0.101.0",
        },
        body: JSON.stringify({ ...body, model }),
      });

      res.statusCode = upstreamResponse.status;
      upstreamResponse.headers.forEach((value, key) => {
        if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      if (!upstreamResponse.body) {
        res.end();
        return;
      }

      const reader = upstreamResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "AI proxy request failed" }));
    }
  };

  return {
    name: "sewa-ai-proxy",
    configureServer(server) {
      server.middlewares.use("/api/chat/completions", chatMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/chat/completions", chatMiddleware);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [aiProxyPlugin(), noKeySearchPlugin(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
