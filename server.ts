import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";
import {
  authenticateUser,
  createAuthSession,
  createChatSessionRecord,
  createNoteRecord,
  createUser,
  deleteAuthSession,
  deleteChatMessageRecord,
  deleteChatSessionRecord,
  deleteNoteRecord,
  getDb,
  getUserBySessionToken,
  listUserChats,
  listUserNotes,
  saveChatMessageRecord,
  updateChatSessionRecord,
  updateUserProfile,
  type PublicUser,
} from "./src/db/database.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_PRIMARY = "gemini-4-hydrogen";
const MODEL_LITE_FALLBACK = "gemini-3.1-flash-lite";
const MODEL_TRANSCRIBE = "gemini-3.5-transcribe";
const MODEL_TTS = "gemini-3.8-flash-lite-tts";
const SESSION_COOKIE_NAME = "yara_session";

function createAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

type AssistantMode = "live" | "deep" | "translate" | "general";

interface AttachmentInput {
  id?: string;
  mimeType: string;
  data: string;
  name?: string;
}

interface ChatMessageInput {
  id?: string;
  role: "user" | "model";
  text: string;
  attachments?: AttachmentInput[];
}

interface GroundingSource {
  title: string;
  uri: string;
}

interface WebSearchSnippet {
  title: string;
  uri: string;
  snippet: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: PublicUser;
  authToken?: string;
}

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
}

function setSessionCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${30 * 24 * 60 * 60}`,
    isHttps ? "SameSite=None; Secure" : "SameSite=Lax",
  ];
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function clearSessionCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    isHttps ? "SameSite=None; Secure" : "SameSite=Lax",
  ];
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "لطفاً ابتدا وارد حساب کاربری خود شوید." });
    return;
  }
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: "نشست کاربری شما منقضی شده است. لطفاً دوباره وارد شوید." });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  next();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaOrRateError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("429") ||
    raw.toLowerCase().includes("quota") ||
    raw.toLowerCase().includes("rate limit")
  );
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapDdgUrl(rawHref: string): string {
  try {
    const normalized = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref;
    const u = new URL(normalized, "https://html.duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return uddg;
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    // ignore malformed URL
  }
  return rawHref;
}

async function runFreeWebSearch(query: string): Promise<WebSearchSnippet[]> {
  const cleanQuery = query.trim().slice(0, 200);
  if (!cleanQuery) return [];

  const results: WebSearchSnippet[] = [];

  try {
    const resp = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; YaraAssistant/1.0)",
          "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(5500),
      }
    );

    if (resp.ok) {
      const html = await resp.text();
      const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

      const links: Array<{ uri: string; title: string }> = [];
      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(html)) !== null && links.length < 6) {
        const uri = unwrapDdgUrl(decodeHtmlEntities(m[1]));
        const title = decodeHtmlEntities(m[2]);
        if (uri.startsWith("http") && title) {
          links.push({ uri, title });
        }
      }

      const snippets: string[] = [];
      while ((m = snippetRegex.exec(html)) !== null && snippets.length < 6) {
        snippets.push(decodeHtmlEntities(m[1] || m[2] || ""));
      }

      for (let i = 0; i < links.length; i++) {
        results.push({
          title: links[i].title,
          uri: links[i].uri,
          snippet: snippets[i] || "",
        });
      }
    }
  } catch {
    // ignore DDG failure
  }

  if (results.length < 2) {
    try {
      const isPersian = /[\u0600-\u06FF]/.test(cleanQuery);
      const lang = isPersian ? "fa" : "en";
      const wikiResp = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&srlimit=3`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (wikiResp.ok) {
        const wikiData = (await wikiResp.json()) as {
          query?: { search?: Array<{ title: string; snippet: string }> };
        };
        for (const item of wikiData.query?.search || []) {
          results.push({
            title: `${item.title} — ویکی‌پدیا`,
            uri: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
            snippet: decodeHtmlEntities(item.snippet),
          });
        }
      }
    } catch {
      // ignore Wikipedia fallback failure
    }
  }

  return results.slice(0, 5);
}

async function fetchUrlContextFallback(text: string): Promise<WebSearchSnippet[]> {
  const urlMatches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi);
  if (!urlMatches || urlMatches.length === 0) return [];

  const snippets: WebSearchSnippet[] = [];
  for (const rawUrl of urlMatches.slice(0, 2)) {
    try {
      const resp = await fetch(rawUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; YaraAssistant/1.0)" },
        signal: AbortSignal.timeout(4500),
      });
      if (!resp.ok) continue;
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/") && !contentType.includes("json")) continue;
      const bodyText = await resp.text();
      const titleMatch = bodyText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const cleanBody = decodeHtmlEntities(
        bodyText
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
      ).slice(0, 2500);
      snippets.push({
        title: titleMatch ? decodeHtmlEntities(titleMatch[1]) : rawUrl,
        uri: rawUrl,
        snippet: cleanBody,
      });
    } catch {
      // ignore URL errors
    }
  }
  return snippets;
}

function getSystemInstruction(
  mode: AssistantMode,
  useWebSearch: boolean,
  userName?: string
): string {
  const today = new Date().toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const baseRules = [
    `تو «یارا» هستی؛ یک دستیار هوشمند واقعی، دقیق، صادق و همه‌کاره به زبان فارسی. تاریخ امروز: ${today}.`,
    userName ? `نام کاربر فعلی: ${userName}. در صورت نیاز محترمانه و صمیمی با او صحبت کن.` : "",
    "اصول بنیادین تو:",
    "۱. هرگز اطلاعات جعلی، آمار ساختگی، لینک خیالی یا پاسخ از روی حدس نساز. اگر درباره موضوعی مطمئن نیستی یا منبع موثقی وجود ندارد، صادقانه بگو.",
    useWebSearch
      ? "۲. جستجوی زنده وب و بررسی لینک فعال است. برای خبرها، قیمت‌ها، رویدادهای روز، مستندات و واقعیت‌ها بر اساس نتایج جستجو و منابع واقعی پاسخ بده و تاریخ/جزئیات را دقیق بیان کن."
      : "۲. جستجوی زنده وب برای این پیام خاموش است؛ بر اساس دانش پایه و فایل‌ها/تصاویر ارسالی پاسخ دقیق بده و اگر نیاز به اطلاعات لحظه‌ای بود، یادآوری کن.",
    "۳. پاسخ‌ها را خوانا، ساختارمند و با زبان روان ارائه بده. برای کدهای برنامه‌نویسی، بلوک کد استاندارد بنویس.",
    "۴. در تحلیل عکس، اسکرین‌شات یا سند، فقط به مواردی اشاره کن که واقعاً در تصویر یا فایل دیده می‌شوند.",
  ].filter(Boolean);

  if (mode === "deep") {
    baseRules.push("حالت فعلی: تحلیل عمیق و مهندسی. مسئله را گام‌به‌گام بررسی کن، خطاها و نکات ظریف را دقیق پیدا کن و راه‌حل کامل ارائه بده.");
  } else if (mode === "translate") {
    baseRules.push("حالت فعلی: مترجم و ویراستار حرفه‌ای. متن را روان، طبیعی و دقیق ترجمه یا ویرایش کن و در صورت نیاز معادل‌های بهتر را پیشنهاد بده.");
  } else if (mode === "general") {
    baseRules.push("حالت فعلی: دستیار سریع و روزمره. پاسخ‌های کوتاه، مفید، کاربردی و بدون حاشیه بده.");
  } else {
    baseRules.push("حالت فعلی: همه‌کاره با جستجوی واقعی. برای هر سوالی بهترین، واقعی‌ترین و مستندترین پاسخ را آماده کن.");
  }

  return baseRules.join("\n");
}

function formatErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("API_KEY_INVALID") || raw.includes("PERMISSION_DENIED") || raw.includes("403")) {
    return {
      status: 403,
      message: "دسترسی به سرویس هوش مصنوعی برقرار نشد. لطفاً وضعیت کلید سرویس را بررسی کنید.",
    };
  }
  if (isQuotaOrRateError(err)) {
    return {
      status: 429,
      message: "سقف موقت درخواست‌های رایگان در این لحظه پر شده است. لطفاً ۱۰ تا ۲۰ ثانیه صبر کنید و دکمه تلاش مجدد را بزنید.",
    };
  }
  if (raw.includes("NOT_FOUND") || raw.includes("404")) {
    return {
      status: 404,
      message: "مدل درخواستی در دسترس نبود.",
    };
  }
  return {
    status: 500,
    message: "خطایی در دریافت پاسخ از هوش مصنوعی رخ داد. لطفاً دوباره امتحان کنید.",
  };
}

function buildContents(messages: ChatMessageInput[]): Content[] {
  return messages.map((msg) => {
    const parts: Part[] = [];
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (!att?.data || !att?.mimeType) continue;
        if (att.mimeType.startsWith("text/") || att.mimeType === "application/json") {
          const decoded = Buffer.from(att.data, "base64").toString("utf-8");
          parts.push({
            text: `[محتوای فایل ${att.name || "پیوست"}]:\n${decoded.slice(0, 30000)}`,
          });
        } else {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        }
      }
    }
    if (msg.text?.trim()) {
      parts.push({ text: msg.text.trim() });
    }
    if (parts.length === 0) {
      parts.push({ text: "لطفاً فایل پیوست‌شده را بررسی کن." });
    }
    return {
      role: msg.role === "model" ? "model" : "user",
      parts,
    };
  });
}

async function startServer() {
  // Initialize SQLite schema on startup
  getDb();

  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGIN || "https://amiralisite.github.io")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const normalized = origin.toLowerCase();
      const isLocal =
        normalized.startsWith("http://localhost:") ||
        normalized.startsWith("http://127.0.0.1:");
      if (isLocal || allowedOrigins.includes("*") || allowedOrigins.includes(normalized)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      }
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: "20mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, model: MODEL_PRIMARY, database: "sqlite" });
  });

  // ==================== AUTH ROUTES ====================
  app.post("/api/auth/register", (req, res) => {
    const { fullName, email, password } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
    };

    const cleanName = (fullName || "").trim();
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPassword = password || "";

    if (cleanName.length < 2) {
      res.status(400).json({ error: "نام و نام خانوادگی باید حداقل ۲ حرف باشد." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: "فرمت ایمیل معتبر نیست." });
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد." });
      return;
    }

    try {
      const user = createUser(cleanName, cleanEmail, cleanPassword);
      const session = createAuthSession(user.id);
      setSessionCookie(req, res, session.token);
      res.status(201).json({ user, token: session.token });
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_EXISTS") {
        res.status(409).json({ error: "این ایمیل قبلاً ثبت‌نام شده است. لطفاً وارد شوید." });
        return;
      }
      res.status(500).json({ error: "خطا در ثبت‌نام حساب کاربری." });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      res.status(400).json({ error: "ایمیل و رمز عبور را وارد کنید." });
      return;
    }

    const user = authenticateUser(email, password);
    if (!user) {
      res.status(401).json({ error: "ایمیل یا رمز عبور اشتباه است." });
      return;
    }

    const session = createAuthSession(user.id);
    setSessionCookie(req, res, session.token);
    res.json({ user, token: session.token });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = extractToken(req);
    if (token) deleteAuthSession(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  app.patch("/api/auth/profile", requireAuth, (req: AuthenticatedRequest, res) => {
    const { fullName, preferredMode } = req.body as {
      fullName?: string;
      preferredMode?: string;
    };
    const updated = updateUserProfile(req.authUser!.id, { fullName, preferredMode });
    res.json({ user: updated });
  });

  // ==================== CHATS CRUD ====================
  app.get("/api/chats", requireAuth, (req: AuthenticatedRequest, res) => {
    const sessions = listUserChats(req.authUser!.id);
    res.json({ sessions });
  });

  app.post("/api/chats", requireAuth, (req: AuthenticatedRequest, res) => {
    const { id, title, mode } = req.body as {
      id?: string;
      title?: string;
      mode?: string;
    };
    const session = createChatSessionRecord(
      req.authUser!.id,
      title || "گفتگوی جدید",
      mode || "live",
      id
    );
    res.status(201).json({ session });
  });

  app.patch("/api/chats/:id", requireAuth, (req: AuthenticatedRequest, res) => {
    const { title, mode } = req.body as { title?: string; mode?: string };
    const sessionId = String(req.params.id);
    const ok = updateChatSessionRecord(req.authUser!.id, sessionId, { title, mode });
    if (!ok) {
      res.status(404).json({ error: "گفتگو پیدا نشد." });
      return;
    }
    res.json({ ok: true });
  });

  app.delete("/api/chats/:id", requireAuth, (req: AuthenticatedRequest, res) => {
    const sessionId = String(req.params.id);
    deleteChatSessionRecord(req.authUser!.id, sessionId);
    res.json({ ok: true });
  });

  app.delete("/api/chats/:sessionId/messages/:msgId", requireAuth, (req: AuthenticatedRequest, res) => {
    deleteChatMessageRecord(req.authUser!.id, String(req.params.msgId));
    res.json({ ok: true });
  });

  // ==================== NOTES CRUD ====================
  app.get("/api/notes", requireAuth, (req: AuthenticatedRequest, res) => {
    const notes = listUserNotes(req.authUser!.id);
    res.json({ notes });
  });

  app.post("/api/notes", requireAuth, (req: AuthenticatedRequest, res) => {
    const { id, title, content, sources, createdAt } = req.body as {
      id?: string;
      title?: string;
      content?: string;
      sources?: GroundingSource[];
      createdAt?: number;
    };
    if (!content?.trim()) {
      res.status(400).json({ error: "متن یادداشت خالی است." });
      return;
    }
    const note = createNoteRecord(req.authUser!.id, {
      id,
      title: title || "یادداشت ذخیره شده",
      content,
      sources,
      createdAt,
    });
    res.status(201).json({ note });
  });

  app.delete("/api/notes/:id", requireAuth, (req: AuthenticatedRequest, res) => {
    deleteNoteRecord(req.authUser!.id, String(req.params.id));
    res.json({ ok: true });
  });

  // ==================== AI CHAT (AUTH + PERSISTENT) ====================
  app.post("/api/chat", requireAuth, async (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      sessionId?: string;
      userMessageId?: string;
      assistantMessageId?: string;
      messages?: ChatMessageInput[];
      mode?: AssistantMode;
      useWebSearch?: boolean;
    };

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      res.status(400).json({ error: "پیامی ارسال نشده است." });
      return;
    }

    const user = req.authUser!;
    const mode: AssistantMode = body.mode || "live";
    const useWebSearch = body.useWebSearch !== false && mode !== "translate";
    const sessionId = body.sessionId;
    const latestUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const assistantMsgId = body.assistantMessageId || `msg_${Date.now()}_a`;

    // Persist user message immediately into SQLite
    if (sessionId && latestUserMsg) {
      const firstTitle = (
        latestUserMsg.text?.trim() ||
        latestUserMsg.attachments?.[0]?.name ||
        "گفتگوی جدید"
      ).slice(0, 42);
      const compactAttachments = (latestUserMsg.attachments || []).map((a, idx) => ({
        id: a.id || `att_${Date.now()}_${idx}`,
        name: a.name || "پیوست",
        mimeType: a.mimeType,
        previewUrl:
          a.mimeType.startsWith("image/") && a.data.length < 300000
            ? `data:${a.mimeType};base64,${a.data}`
            : undefined,
      }));
      saveChatMessageRecord(
        user.id,
        sessionId,
        {
          id: body.userMessageId || latestUserMsg.id || `msg_${Date.now()}_u`,
          role: "user",
          text: latestUserMsg.text || "",
          createdAt: Date.now(),
          attachments: compactAttachments.length > 0 ? compactAttachments : undefined,
        },
        firstTitle,
        mode
      );
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const ai = createAIClient();
      const baseContents = buildContents(messages);
      const lastUserText = latestUserMsg?.text || "";

      const primaryThinkingLevel =
        mode === "deep"
          ? ThinkingLevel.XHIGH
          : mode === "general" || mode === "translate"
            ? ThinkingLevel.LOW
            : ThinkingLevel.MEDIUM;

      let fullAssistantText = "";

      const streamResult = async (
        model: string,
        contentsToSend: Content[],
        thinkingLevel: ThinkingLevel,
        withBuiltInTools: boolean
      ) => {
        const tools = withBuiltInTools ? [{ googleSearch: {} }, { urlContext: {} }] : undefined;
        const stream = await ai.models.generateContentStream({
          model,
          contents: contentsToSend,
          config: {
            systemInstruction: getSystemInstruction(mode, useWebSearch, user.fullName),
            thinkingConfig: { thinkingLevel },
            ...(tools ? { tools } : {}),
          },
        });

        const sourcesMap = new Map<string, GroundingSource>();
        const queriesSet = new Set<string>();

        for await (const chunk of stream) {
          if (chunk.text) {
            fullAssistantText += chunk.text;
            sendEvent({ type: "chunk", text: chunk.text });
          }

          const grounding = chunk.candidates?.[0]?.groundingMetadata;
          if (grounding?.groundingChunks) {
            for (const gc of grounding.groundingChunks) {
              if (gc.web?.uri) {
                sourcesMap.set(gc.web.uri, {
                  uri: gc.web.uri,
                  title: gc.web.title || gc.web.uri,
                });
              }
            }
          }
          if (grounding?.webSearchQueries) {
            for (const q of grounding.webSearchQueries) {
              if (q) queriesSet.add(q);
            }
          }
        }

        return {
          sources: Array.from(sourcesMap.values()),
          queries: Array.from(queriesSet.values()),
        };
      };

      let finalSources: GroundingSource[] = [];
      let finalQueries: string[] = [];

      try {
        const r = await streamResult(MODEL_PRIMARY, baseContents, primaryThinkingLevel, useWebSearch);
        finalSources = r.sources;
        finalQueries = r.queries;
      } catch (err1) {
        console.warn("[/api/chat] Attempt 1 fallback:", err1 instanceof Error ? err1.message : String(err1));

        let contentsWithFreeSearch = baseContents;
        if (useWebSearch && lastUserText.trim()) {
          const [webSnippets, urlSnippets] = await Promise.all([
            runFreeWebSearch(lastUserText),
            fetchUrlContextFallback(lastUserText),
          ]);
          const combined = [...urlSnippets, ...webSnippets];
          if (combined.length > 0) {
            finalSources = combined.map((s) => ({ title: s.title, uri: s.uri }));
            const contextText = combined
              .map(
                (s, i) =>
                  `[منبع ${i + 1}] عنوان: ${s.title}\nآدرس: ${s.uri}\nخلاصه: ${s.snippet}`
              )
              .join("\n\n");

            const cloned = [...baseContents];
            const lastIdx = cloned.length - 1;
            const lastMsg = cloned[lastIdx];
            cloned[lastIdx] = {
              ...lastMsg,
              parts: [
                ...(lastMsg.parts || []),
                {
                  text: `\n\n[نتایج جستجوی زنده وب برای کمک به پاسخ واقعی و مستند]:\n${contextText}`,
                },
              ],
            };
            contentsWithFreeSearch = cloned;
          }
        }

        await sleep(500);
        try {
          await streamResult(MODEL_PRIMARY, contentsWithFreeSearch, ThinkingLevel.LOW, false);
        } catch (err2) {
          console.warn("[/api/chat] Attempt 2 failed, trying lite fallback:", err2 instanceof Error ? err2.message : String(err2));
          await sleep(700);
          await streamResult(MODEL_LITE_FALLBACK, contentsWithFreeSearch, ThinkingLevel.MINIMAL, false);
        }
      }

      if (finalSources.length > 0 || finalQueries.length > 0) {
        sendEvent({
          type: "sources",
          sources: finalSources,
          queries: finalQueries,
        });
      }

      // Persist complete assistant message into SQLite
      if (sessionId && fullAssistantText.trim()) {
        saveChatMessageRecord(user.id, sessionId, {
          id: assistantMsgId,
          role: "model",
          text: fullAssistantText,
          createdAt: Date.now(),
          sources: finalSources.length > 0 ? finalSources : undefined,
          queries: finalQueries.length > 0 ? finalQueries : undefined,
          isError: false,
        });
      }

      sendEvent({ type: "done" });
      res.end();
    } catch (err) {
      console.error("[/api/chat] All free-tier attempts failed:", err instanceof Error ? err.message : String(err));
      const mapped = formatErrorMessage(err);
      if (sessionId) {
        saveChatMessageRecord(user.id, sessionId, {
          id: assistantMsgId,
          role: "model",
          text: mapped.message,
          createdAt: Date.now(),
          isError: true,
        });
      }
      sendEvent({ type: "error", message: mapped.message });
      res.end();
    }
  });

  app.post("/api/transcribe", requireAuth, async (req, res) => {
    const { audioBase64, mimeType } = req.body as {
      audioBase64?: string;
      mimeType?: string;
    };

    if (!audioBase64 || !mimeType) {
      res.status(400).json({ error: "فایل صوتی ارسال نشده است." });
      return;
    }

    try {
      const ai = createAIClient();
      const contents = {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: "این فایل صوتی را دقیقاً به متن تبدیل کن. فقط خود متن گفتار را بنویس و هیچ توضیح یا مقدمه اضافی نگذار.",
          },
        ],
      };

      try {
        const response = await ai.models.generateContent({
          model: MODEL_TRANSCRIBE,
          contents,
        });
        res.json({ text: (response.text ?? "").trim() });
      } catch (err1) {
        if (!isQuotaOrRateError(err1)) throw err1;
        await sleep(600);
        const fallback = await ai.models.generateContent({
          model: MODEL_LITE_FALLBACK,
          contents,
        });
        res.json({ text: (fallback.text ?? "").trim() });
      }
    } catch (err) {
      const mapped = formatErrorMessage(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post("/api/tts", requireAuth, async (req, res) => {
    const { text, voiceName } = req.body as {
      text?: string;
      voiceName?: string;
    };

    const cleanText = (text ?? "")
      .replace(/```[\s\S]*?```/g, " کد برنامه‌نویسی. ")
      .replace(/[#*_`>~]/g, "")
      .trim()
      .slice(0, 2500);

    if (!cleanText) {
      res.status(400).json({ error: "متنی برای خواندن وجود ندارد." });
      return;
    }

    try {
      const ai = createAIClient();
      const response = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: "Clear, natural, warm and helpful assistant",
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Kore",
              },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(500).json({ error: "تولید صدا ناموفق بود." });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
      });
    } catch (err) {
      const mapped = formatErrorMessage(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Yara AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
