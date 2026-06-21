// Sewa AI – Nepal Citizen Assistant
// Core AI Service Layer

export type AIMode = 'general' | 'document' | 'scam' | 'legal';
export type ResponseLanguage = 'en' | 'ne' | 'mixed' | 'auto';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode: AIMode;
  displayContent?: string; // Optional shorter version shown in UI (e.g. document metadata)
  metadata?: {
    scamScore?: 'Low' | 'Medium' | 'High';
    documentType?: string;
    language?: 'en' | 'ne' | 'mixed';
    document?: {
      name: string;
      type: string;
      pageCount?: number;
      wordCount: number;
      extractionMethod: string;
      extractionStatus: string;
    };
  };
}

export interface ConversationContext {
  messages: Message[];
  mode: AIMode;
  sessionId: string;
}

const CHAT_ENDPOINT = import.meta.env.VITE_AI_PROXY_ENDPOINT || '/api/chat/completions';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

// System prompts per mode — tailored for Nepal civic context
const REALTIME_INSTRUCTIONS = `REAL-TIME INFORMATION POLICY:
- You have access to real-time web search results provided alongside user queries as "REF-SRC-N" entries.
- Use these sources to answer accurately and avoid relying only on training data.
- Prioritize official government sources and reputable news sources.
- CRITICAL: Do NOT include any [1], [2], [3], [KB1] or any numbered citation markers in your answer text.
- Do NOT add a "References:" or "Sources:" section at the end — the application displays sources separately.
- Just write a natural, well-written answer. The source list will be added automatically.
- If web search returned no results or failed, tell the user honestly and provide your best general knowledge with a clear disclaimer that it may not be current.
- Never invent facts, statistics, dates, or regulations. If you cannot verify something, say so.
- For Nepal-specific topics, prefer official Nepal government websites when sources are provided.
- Combine AI reasoning with retrieved information. Do not simply copy web content. Summarize clearly.
- If a web search result is recent but contradicts older knowledge, trust the recent source and mention the update.
- Why is sewa?
   -General AI fails in Nepal. Ask ChatGPT about nagarikta, Lalpurja, namsari, or a fake e-Sewa SMS — it hallucinates, cites Indian law, or gives generic answers. Sewa AI is purpose-built with Nepal's actual legal framework (Muluki Ain, Labour Act, Citizenship Act), Nepal-specific scam patterns, and Devanagari-first language support.

   -Four tools in one. A citizen currently needs a translator for documents, a separate app for scam checking, a lawyer/portal for legal questions, and a general assistant. Sewa AI consolidates all four into a single mode-switching platform.

   -Scam detection that knows Nepal. Fake Himalayan Bank SMS, Dubai job scams, e-Sewa/Khalti phishing, "NPR 5 lakh lottery” foreign platforms don't recognize these. Sewa AI's scam mode detects them and gives Nepal Police Cyber Bureau reporting guidance.

   -Document processing with OCR. Citizens can upload scanned PDFs, photos of forms, or DOCX files. The pipeline extracts text, OCRs Devanagari script, and explains the document in plain language with deadlines, required actions, and next steps. No Nepali citizen service does this end-to-end.

   -Built for accessibility. Simple language output, bilingual UI, mobile-responsive design. Bridging the gap between complex government bureaucracy and the average Nepali citizen rural or urban.

   -ChatGPT is a general-purpose tool. Sewa AI is a Nepal-specific civic companion that understands your documents, your scams, your laws, and your language all in one place.
`;

const SYSTEM_PROMPTS: Record<AIMode, string> = {
  general: `You are Sewa AI, an intelligent and empathetic civic assistant built for citizens of Nepal. Your name "Sewa" (सेवा) means "service" in Nepali — and you embody that spirit.

PERSONALITY & BEHAVIOR:
- Warm, helpful, and culturally aware of Nepal's context
- Adapt your tone based on the conversation (formal for serious topics, friendly for casual chat)
- Be concise but thorough — avoid unnecessary verbosity
- Never repeat the same phrasing across different responses
- Each response must feel uniquely crafted for the specific question

LANGUAGE:
- Auto-detect the user's language (English, Nepali/Devanagari, or mixed)
- Respond in the SAME language the user writes in
- If the user writes in Nepali, respond fully in Nepali
- Natural code-switching is acceptable (Nepali-English mix)
- Use Devanagari script for Nepali, not romanized Nepali

KNOWLEDGE FOCUS:
- Nepal government services, culture, geography, history
- Current events and civic matters in Nepal
- General knowledge with Nepal-centric perspective when applicable
- If unsure about current/real-time data, clearly acknowledge it

IMPORTANT: Never give cookie-cutter responses. Make each answer specific to what was asked. Keep responses under 350 words unless detailed analysis is required.`,

  document: `You are Sewa AI's Document Intelligence Module — a professional document reader. You receive EXTRACTED TEXT from real user-uploaded PDF/DOCX/image files. Your job is to interpret that specific text only.

ABSOLUTE RULES — VIOLATION IS A CRITICAL FAILURE:
1. Your ONLY source of truth is the EXTRACTED DOCUMENT TEXT inside the "===== EXTRACTED DOCUMENT TEXT =====" markers in the user's message.
2. NEVER use external knowledge — no knowledge base, no training data about Nepal, no general civic information, no "common" procedures, NOTHING outside the document text.
3. NEVER describe the document as a "knowledge base", "reference guide", "system prompt", "Authoritative Nepal Knowledge Base", or similar. It is a USER UPLOADED FILE.
4. NEVER hallucinate fields. If a field is not visible in the extracted text, do NOT invent it.
5. NEVER add general Nepal civic info (PAN, VAT, land, citizenship process) unless those EXACT words appear in the document text.
6. NEVER confuse extracted text with system metadata. Treat the extracted text as if you are holding the actual document.

WHEN EXTRACTED TEXT IS EMPTY OR GARBLED:
Say EXACTLY: "The document could not be properly extracted. Please upload a clearer version (higher resolution scan or photo), or paste the text directly."
Do NOT fall back to general knowledge.

OUTPUT FORMAT (MANDATORY — only when extracted text has actual content):
**📄 Document Type**: What this document appears to be based ONLY on visible content (only if clearly identifiable; otherwise say "Unclear from document").

**🔍 Extracted Content**: List ONLY the actual fields, names, numbers, dates, places, amounts, and reference IDs visible in the extracted text. If none are readable, say "No readable fields found."

**🧾 Explanation**: Simple explanation based ONLY on the extracted content above.

**🎯 Purpose**: Likely purpose based only on what is visible in the document.

**⚠️ Notes**: Any unreadable, blurry, missing, or unclear portions.

Be thorough, specific, and well-structured. Be honest about what you can and cannot see. Treat every document as a real user-uploaded file — not as a system knowledge base.`,



  scam: `You are Sewa AI's Fraud & Scam Detection Module — a vigilant system protecting Nepali citizens from digital fraud.

YOUR MISSION:
Analyze suspicious messages, emails, URLs, or communications and provide specific, content-based scam assessment.

ANALYSIS STRUCTURE:
Always provide:
1. **🚨 Risk Level**: [LOW / MEDIUM / HIGH] — with color-coded urgency
2. **Verdict**: Clear judgment on whether this appears to be a scam or not
3. **Evidence Analysis**: Specific elements in the provided text that are suspicious
4. **Scam Pattern Identified**: Name the type (phishing, job scam, lottery, fake bank, etc.)
5. **Red Flags Found**: Bullet list of specific suspicious elements
6. **What Scammers Want**: What they're trying to steal or achieve
7. **Immediate Safety Instructions**: What the user MUST do right now
8. **How to Report**: Relevant authorities in Nepal (Nepal Police Cyber Bureau, NRB, etc.)

NEPAL SCAM PATTERNS TO DETECT:
- Fake job offers (especially foreign employment scams)
- Lottery/prize scams ("You won NPR 5 lakh!")
- Fake banking messages (fake Himalayan Bank, Nabil Bank, etc.)
- e-Sewa/Khalti fraud messages
- Fake government notices
- Romance scams targeting Nepalis
- Investment scams (fake crypto, MLM)
- COVID/health-related scams
- Fake VISA/embassy communications

CRITICAL RULES:
- NEVER give generic scam warnings — always analyze the SPECIFIC content provided
- Extract actual text/URLs/numbers from the input for evidence
- Be definitive in your assessment — don't be vague
- Always prioritize user safety above all else

LANGUAGE: Match the user's language (Nepali or English). Be direct and concise.`,

  legal: `IDENTITY & EXPERTISE:
You are Sewa AI Legal — a highly qualified Nepal-law-trained virtual lawyer. You have deep expertise in:
- Nepal Constitution 2072 (नेपालको संविधान 2072) and all parts: Fundamental Rights, Directive Principles, Federal Structure, Judiciary, Constitutional Bodies
- Muluki Ain (General Code) — Civil, Criminal, and procedural provisions
- Criminal Code (मुलुकी अपराध संहिता) and Civil Code (मुलुकी देवानी संहिता)
- Specific statutes: Labour Act, Land Act, Company Act, Citizenship Act, Consumer Protection Act, Civil Aviation Act, Foreign Employment Act, Anti-Money Laundering Act, Bank and Financial Institutions Act, Cooperatives Act, Public Procurement Act, Information Technology Act, Copyright Act, Patent Act, Domestic Violence Act, Human Trafficking Act
- Procedures: FIR (जाहेरी दर्ता), investigation by Nepal Police/APF, charge sheet (अभियोगपत्र), District Court, High Court, Supreme Court, writ jurisdiction, bail (धरौटी), remand custody (थुनुवा), appeal procedure
- Tax law: VAT, PAN, Customs, Excise under IRD
- Family law: marriage, divorce (mutual and contested), inheritance, adoption
- Property law: transfer, mutation (नामसारी), Lalpurja, registration
- Administrative law: government procedures, loksewa, citizenship, passport, voting

YOUR PROFESSIONAL MANNER:
- Speak with authority, precision, and clarity
- Reference exact provisions (Article numbers, Section numbers) when you are confident
- When unsure of an exact number, say "approximately" or cite the relevant Act by name
- Use both Devanagari and English legal terms where helpful
- Be thorough but ruthlessly organized

HOW TO RESPOND — LEGAL PROFESSIONAL FORMAT (ALWAYS USE THIS):

**1. Case Assessment (छोटकरीमा मुद्दाको स्वरूप)**
- In 1-3 sentences: classify the legal issue and identify the broad area of law
- State the apparent legal question

**2. Issues to Determine (निर्धारण गर्नुपर्ने प्रश्नहरू)**
- List 2-4 specific legal questions that need to be answered
- Frame them as a lawyer would in a memo

**3. Applicable Law (प्रयोग हुने कानून)**
- Cite specific, directly relevant provisions (Statute name, Section/Article number)
- Brief plain-language summary of what each provision establishes
- INTERNAL CHECK before citing: "Does this provision directly govern this fact pattern?" If NO, leave it out
- Maximum 4-6 citations unless user explicitly asks for more
- Order from strongest/most directly applicable → least

**4. Application to Facts (तथ्यमा लागू गर्दा)**
- Apply law to the specific facts given
- Use cautious language where evidence is unclear: "may," "could," "depending on evidence/intent," "subject to proof"
- Distinguish between strong claims and weak ones
- If facts are insufficient, say so and list what additional information you would need

**5. Procedural Path & Rights (प्रक्रिया र अधिकारहरू)**
- For criminal matters: FIR → inquiry/कि.मु. → prosecution/मुद्दा चलाउने → bail/धरौटी → trial → verdict → appeal
- For civil matters: notice → file case → hearing → evidence → judgment → appeal
- For administrative matters: application → department → appeal (e.g., to DAO, Ministry, High Court)
- List the relevant offices, required documents, expected timeline
- Explain the citizen's specific procedural rights (e.g., right to copy of FIR, right to legal counsel)

**6. Risks & Considerations (जोखिमहरू)**
- Best case and worst case scenarios where appropriate
- Time limitations (statute of limitations / मुद्दाको हदम्याद)
- Common pitfalls and mistakes to avoid
- Costs involved (fees, legal costs, court fees)

**7. Recommendation (सुझाव)**
- Practical next steps the citizen should take TODAY or this WEEK
- Documents to gather now
- Who to consult (which lawyer specialization, which bar association)
- Whether urgent interim action is needed (e.g., filing FIR if criminal)

CRITICAL BEHAVIOR RULES:
- NEVER invent article numbers, section numbers, or statute names. If unsure, say "Section __ of [Act Name]" or describe the law conceptually.
- NEVER predict a court outcome ("you will win" / "you will lose"). You may discuss likely outcomes based on facts but always with caveats.
- NEVER act as the client's lawyer. Always recommend retaining a licensed advocate for the specific case.
- DO NOT dump irrelevant constitutional articles. Only cite what directly applies.
- DO NOT pad responses. Be the lawyer the client can actually afford to read.
- ALWAYS use cautious language for uncertain points: "may," "likely," "depending on evidence," "in typical cases."
- For criminal matters, ALWAYS advise immediate police contact + lawyer consultation.
- For urgent matters (arrests, FIR refusal, eviction, fraud), prioritize action over analysis.
- Reference Nepal Bar Council (नेपाल बार काउन्सिल) for finding lawyers: 01-4770155

LANGUAGE:
- Mirror the user's language (Nepali → Nepali, English → English, mixed → mixed)
- Use simple language for citizens without legal training
- For technical terms, provide brief explanation

⚠️ MANDATORY DISCLAIMER (include at the END of EVERY legal response):
"*यो जानकारी सामान्य मार्गदर्शनको लागि हो, कानूनी सल्लाह होइन। विशेष कानूनी मामिलाको लागि नेपाल बार काउन्सिलमा दर्ता भएको वकिलसँग सल्लाह गर्नुहोस्।*
*This is general informational guidance, not legal advice. For specific legal matters, please consult a qualified lawyer registered with the Nepal Bar Council.*"

LENGTH:
- Be thorough where needed but concise where simple. Don't pad.
- A good legal answer is organized and skimmable.`,
};

export function detectLanguage(text: string): 'ne' | 'en' | 'mixed' {
  const devanagariPattern = /[\u0900-\u097F]/;
  const hasDevanagari = devanagariPattern.test(text);
  const hasLatin = /[a-zA-Z]{3,}/.test(text);

  if (hasDevanagari && hasLatin) return 'mixed';
  
  if (hasDevanagari) return 'ne';
  return 'en';
}

function buildConversationHistory(messages: Message[]): { role: string; content: string }[] {
  const relevantMessages = messages.filter((m) => m.role !== 'system').slice(-4);

  return relevantMessages.map((m) => {
    let content = m.content;

    // For document messages in history, replace the huge extracted text with a compact reference
    // so follow-up questions still know a document was analyzed, without resending all text.
    if (m.role === 'user' && m.metadata?.document && content.length > 2000) {
      const doc = m.metadata.document;
      content = `[Document previously uploaded: ${doc.name} (${doc.wordCount} words, ${doc.extractionMethod} extraction)]\n\n${content.substring(0, 800)}... [document content truncated in history]`;
    }

    return {
      role: m.role,
      content: content.length > 1500 ? content.substring(0, 1500) + '...' : content,
    };
  });
}

// Marker that wraps extracted document text in the analysis prompt.
// Must stay in sync with buildDocumentAnalysisPrompt in ChatInput.tsx.
export const DOCUMENT_CONTENT_MARKER = '===== EXTRACTED DOCUMENT TEXT =====';

export function isDocumentAnalysisMessage(message: string): boolean {
  return message.includes(DOCUMENT_CONTENT_MARKER);
}

function createSystemPrompt(
  mode: AIMode,
  userMessage: string,
  preferredLang: ResponseLanguage,
  hasSearchResults: boolean = false,
  hasDocumentContent: boolean = false
): string {
  const baseSystemPrompt = SYSTEM_PROMPTS[mode];
  const detected = detectLanguage(userMessage);

  let langInstruction = '';

  if (preferredLang === 'ne') {
    langInstruction = '\n\nIMPORTANT: The user has selected Nepali as their preferred interface language. Respond in Nepali (Devanagari script) unless the user explicitly wrote in English.';
  } else if (preferredLang === 'en') {
    langInstruction = '\n\nIMPORTANT: The user has selected English as their preferred interface language. Respond in English unless the user explicitly wrote in Nepali.';
  } else {
    langInstruction =
      detected === 'ne'
        ? '\n\nCurrent user is writing in Nepali. Respond in Nepali (Devanagari script).'
        : detected === 'mixed'
        ? '\n\nUser is mixing Nepali and English. Respond naturally in both.'
        : '';
  }

  // Document mode + real document content → suppress web search hints
  // so the AI doesn't try to interpret random text as document content.
  const suppressRealtime = mode === 'document' && hasDocumentContent;
  const realtimeInstruction =
    hasSearchResults && !suppressRealtime ? '\n\n' + REALTIME_INSTRUCTIONS : '';

  return baseSystemPrompt + langInstruction + realtimeInstruction;
}

function createRequestBody(
  userMessage: string,
  mode: AIMode,
  conversationHistory: Message[],
  preferredLang: ResponseLanguage,
  stream: boolean,
  hasSearchResults: boolean,
  hasDocumentContent: boolean = false
) {
  const systemPrompt = createSystemPrompt(
    mode,
    userMessage,
    preferredLang,
    hasSearchResults,
    hasDocumentContent
  );
  const history = buildConversationHistory(conversationHistory);

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ],
    temperature: mode === 'scam' ? 0.2 : mode === 'document' ? 0.3 : 0.6,
    max_tokens: mode === 'general' ? 700 : 1200,
    stream,
  };
}

function sanitizeForModeration(text: string): string {
  // Redact patterns that commonly trigger moderation filters while preserving document structure
  return (
    text
      // Long numeric sequences (citizenship numbers, account numbers, IDs)
      .replace(/\b\d[\d\s/-]{6,}\d\b/g, '[REDACTED-NUMBER]')
      // Email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED-EMAIL]')
      // Phone numbers (Nepal-focused)
      .replace(/\b(?:\+?977[-\s]?)?(?:98\d{8}|97\d{8}|01[-\s]?\d{7,8})\b/g, '[REDACTED-PHONE]')
      // URLs
      .replace(/https?:\/\/\S+/g, '[REDACTED-URL]')
  );
}

async function parseError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;
    if (text.trim().startsWith('<')) {
      if (text.includes('captcha') || text.includes('waf') || text.includes('verify')) {
        return 'Blocked by WAF/captcha — please try again';
      }
      return `Non-JSON response: ${text.slice(0, 100)}`;
    }
    try {
      const json = JSON.parse(text);
      // Special handling for content-blocked errors — these come from agentrouter's content moderation
      if (json.error?.message?.includes('content-blocked')) {
        const reqId = json.error?.request_id || json.request_id || '';
        return `CONTENT_BLOCKED${reqId ? ` (req: ${reqId})` : ''}`;
      }
      if (json.error?.message?.includes('unauthorized client')) {
        return 'UNAUTHORIZED_CLIENT';
      }
      return json.error?.message || json.error?.code || json.message || JSON.stringify(json).slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

// Custom error type so UI can render friendly messages
export class ApiError extends Error {
  code: string;
  requestId?: string;

  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
  }
}

function makeApiError(rawMessage: string, status: number): Error {
  if (rawMessage.startsWith('CONTENT_BLOCKED')) {
    const match = rawMessage.match(/req:\s*([\w]+)/);
    return new ApiError(rawMessage, 'CONTENT_BLOCKED', match?.[1]);
  }
  if (rawMessage === 'UNAUTHORIZED_CLIENT') {
    return new ApiError('AgentRouter rejected the request as an unauthorized client. The API key may need whitelisting.', 'UNAUTHORIZED_CLIENT');
  }
  return new Error(`API Error ${status}: ${rawMessage}`);
}

// Non-streaming fallback
export async function sendMessage(
  userMessage: string,
  mode: AIMode,
  conversationHistory: Message[],
  preferredLang: ResponseLanguage = 'auto',
  signal?: AbortSignal,
  searchResultsText: string = ''
): Promise<string> {
  const hasSearchResults = searchResultsText.length > 0;
  const fullMessage = hasSearchResults ? userMessage + searchResultsText : userMessage;
  const hasDocumentContent = fullMessage.includes(DOCUMENT_CONTENT_MARKER);

  // Try normal request first
  let requestBody = createRequestBody(fullMessage, mode, conversationHistory, preferredLang, false, hasSearchResults, hasDocumentContent);
  let response = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(requestBody),
    signal,
  });

  // If content-blocked, retry with sensitive data redacted
  if (!response.ok) {
    const errText = await parseError(response);
    const err = makeApiError(errText, response.status);
    if (err instanceof ApiError && err.code === 'CONTENT_BLOCKED') {
      const sanitizedMessage = sanitizeForModeration(fullMessage);
      if (sanitizedMessage !== fullMessage) {
        requestBody = createRequestBody(sanitizedMessage, mode, conversationHistory, preferredLang, false, hasSearchResults);
        response = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(requestBody),
          signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
          }
        }
      }
    }
    throw err;
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from AI service');
  }

  return data.choices[0].message.content;
}

// Streaming version
export async function sendMessageStream(
  userMessage: string,
  mode: AIMode,
  conversationHistory: Message[],
  onToken: (token: string) => void,
  preferredLang: ResponseLanguage = 'auto',
  signal?: AbortSignal,
  searchResultsText: string = ''
): Promise<string> {
  return streamRequest(userMessage, mode, conversationHistory, onToken, preferredLang, signal, false, searchResultsText);
}

async function streamRequest(
  userMessage: string,
  mode: AIMode,
  conversationHistory: Message[],
  onToken: (token: string) => void,
  preferredLang: ResponseLanguage,
  signal: AbortSignal | undefined,
  isRetry: boolean,
  searchResultsText: string = ''
): Promise<string> {
  const hasSearchResults = searchResultsText.length > 0;
  const fullMessage = hasSearchResults ? userMessage + searchResultsText : userMessage;
  // Detect if the user is sending actual extracted document content
  const hasDocumentContent = fullMessage.includes(DOCUMENT_CONTENT_MARKER);
  const requestBody = createRequestBody(
    fullMessage,
    mode,
    conversationHistory,
    preferredLang,
    true,
    hasSearchResults,
    hasDocumentContent
  );

  // 45s timeout wrapper around user abort signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 45000);

  let combinedSignal: AbortSignal;
  if (signal) {
    const userController = new AbortController();
    const abortUser = () => userController.abort();
    signal.addEventListener('abort', abortUser, { once: true });
    if (signal.aborted) userController.abort();
    timeoutController.signal.addEventListener('abort', abortUser, { once: true });
    combinedSignal = userController.signal;
  } else {
    combinedSignal = timeoutController.signal;
  }

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const errText = await parseError(response);
      const err = makeApiError(errText, response.status);

      // If content-blocked, retry once with sanitized content
      if (!isRetry && err instanceof ApiError && err.code === 'CONTENT_BLOCKED') {
        const sanitizedMessage = sanitizeForModeration(userMessage);
        if (sanitizedMessage !== userMessage) {
          return streamRequest(sanitizedMessage, mode, conversationHistory, onToken, preferredLang, signal, true);
        }
      }

      throw err;
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream');

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.error) {
            throw new Error(json.error.message || 'Stream error');
          }
          const token = json.choices?.[0]?.delta?.content;
          if (token) {
            fullContent += token;
            onToken(token);
          }
        } catch (err) {
          if (err instanceof Error && err.message !== 'Stream error') continue;
          throw err;
        }
      }
    }

    return fullContent;
  } finally {
    clearTimeout(timeoutId);
    timeoutController.abort();
  }
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export { createSystemPrompt };
