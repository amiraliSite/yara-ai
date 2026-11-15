import type { AssistantMode, Attachment, ChatMessage, GroundingSource, UserProfile } from "../types";

const STATIC_USERS_KEY = "yara_static_users_v1";
const STATIC_SESSION_KEY = "yara_static_active_token_v1";
const STATIC_MODE_FLAG_KEY = "yara_static_mode_v1";

interface StoredStaticUser {
  id: string;
  fullName: string;
  email: string;
  salt: string;
  passwordHash: string;
  avatarColor: string;
  preferredMode: AssistantMode;
  createdAt: number;
}

interface StoredStaticSession {
  token: string;
  userId: string;
  expiresAt: number;
}

const AVATAR_COLORS = ["#0F766E", "#0369A1", "#1D4ED8", "#047857", "#B45309", "#334155"];

export function isStaticHostMode(): boolean {
  try {
    if (localStorage.getItem(STATIC_MODE_FLAG_KEY) === "1") return true;
    const host = window.location.hostname.toLowerCase();
    return host.endsWith(".github.io") || host === "github.io";
  } catch {
    return false;
  }
}

export function markStaticHostMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(STATIC_MODE_FLAG_KEY, "1");
    } else {
      localStorage.removeItem(STATIC_MODE_FLAG_KEY);
    }
  } catch {
    // ignore
  }
}

export function isNonJsonStaticResponse(response: Response): boolean {
  const ct = (response.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return true;
  return response.status === 404 || response.status === 405;
}

function randomHex(bytesLen = 16): string {
  const arr = new Uint8Array(bytesLen);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytesLen; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashWithSalt(password: string, salt: string): Promise<string> {
  const raw = `${salt}:${password}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Minimal deterministic fallback if crypto.subtle unavailable
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function loadStaticUsers(): StoredStaticUser[] {
  try {
    const raw = localStorage.getItem(STATIC_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredStaticUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStaticUsers(users: StoredStaticUser[]): void {
  localStorage.setItem(STATIC_USERS_KEY, JSON.stringify(users));
}

function toPublicUser(u: StoredStaticUser): UserProfile {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    avatarColor: u.avatarColor,
    preferredMode: u.preferredMode,
    createdAt: u.createdAt,
  };
}

function createStaticSessionForUser(userId: string): string {
  const token = `local_${randomHex(24)}`;
  const session: StoredStaticSession = {
    token,
    userId,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(session));
  return token;
}

export async function staticRegisterUser(
  fullName: string,
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const users = loadStaticUsers();

  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error("این ایمیل قبلاً ثبت‌نام شده است. لطفاً وارد شوید.");
  }

  const salt = randomHex(12);
  const passwordHash = await hashWithSalt(password, salt);
  const user: StoredStaticUser = {
    id: `usr_${randomHex(8)}`,
    fullName: cleanName,
    email: cleanEmail,
    salt,
    passwordHash,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    preferredMode: "live",
    createdAt: Date.now(),
  };

  users.push(user);
  saveStaticUsers(users);
  markStaticHostMode(true);
  const token = createStaticSessionForUser(user.id);
  return { user: toPublicUser(user), token };
}

export async function staticLoginUser(
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const users = loadStaticUsers();
  const found = users.find((u) => u.email === cleanEmail);

  if (!found) {
    throw new Error("حسابی با این ایمیل پیدا نشد. لطفاً ابتدا ثبت‌نام کنید.");
  }

  const candidateHash = await hashWithSalt(password, found.salt);
  if (candidateHash !== found.passwordHash) {
    throw new Error("ایمیل یا رمز عبور اشتباه است.");
  }

  markStaticHostMode(true);
  const token = createStaticSessionForUser(found.id);
  return { user: toPublicUser(found), token };
}

export function staticGetCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STATIC_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredStaticSession;
    if (!session?.userId || session.expiresAt < Date.now()) {
      localStorage.removeItem(STATIC_SESSION_KEY);
      return null;
    }
    const users = loadStaticUsers();
    const found = users.find((u) => u.id === session.userId);
    return found ? toPublicUser(found) : null;
  } catch {
    return null;
  }
}

export function staticLogoutUser(): void {
  try {
    localStorage.removeItem(STATIC_SESSION_KEY);
  } catch {
    // ignore
  }
}

function normalizePersianDigits(input: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

function trySafeArithmetic(text: string): string | null {
  const normalized = normalizePersianDigits(text)
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/؟|\?/g, "")
    .trim();

  if (!/^[0-9+\-*/().\s%^]+$/.test(normalized)) return null;
  if (!/[+\-*/%^]/.test(normalized)) return null;

  try {
    const expr = normalized.replace(/\^/g, "**");
    const fn = new Function(`"use strict"; return (${expr});`) as () => unknown;
    const result = fn();
    if (typeof result === "number" && Number.isFinite(result)) {
      return `نتیجه محاسبه:\n\n\`${normalized} = ${result.toLocaleString("fa-IR")}\` (${result})`;
    }
  } catch {
    return null;
  }
  return null;
}

async function searchWikipediaCors(
  lang: "fa" | "en",
  query: string
): Promise<Array<{ title: string; extract: string; uri: string }>> {
  const cleanQuery = query.trim().slice(0, 120);
  if (!cleanQuery) return [];
  const url =
    `https://${lang}.wikipedia.org/w/api.php?` +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: cleanQuery,
      gsrlimit: "3",
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      inprop: "url",
      utf8: "",
      format: "json",
      origin: "*",
    }).toString();

  const resp = await fetch(url, { signal: AbortSignal.timeout(6500) });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          extract?: string;
          fullurl?: string;
          index?: number;
        }
      >;
    };
  };

  const pages = Object.values(data.query?.pages || {});
  pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  return pages
    .filter((p) => p.title && p.fullurl && p.extract && p.extract.trim().length > 20)
    .map((p) => ({
      title: p.title as string,
      extract: (p.extract as string).trim().slice(0, 1100),
      uri: p.fullurl as string,
    }));
}

function decodeAttachmentText(att: Attachment): string | null {
  if (!att.data) return null;
  if (!att.mimeType.startsWith("text/") && att.mimeType !== "application/json") return null;
  try {
    const bin = atob(att.data);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes).slice(0, 12000);
  } catch {
    return null;
  }
}

function buildStaticSystemPrompt(
  mode: AssistantMode,
  useWebSearch: boolean,
  userName?: string,
  wikiContext?: string
): string {
  const today = new Date().toLocaleDateString("fa-IR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const parts = [
    `تو «یارا» هستی؛ یک دستیار هوش مصنوعی فارسی‌زبانِ واقعی، دقیق، باسواد، صمیمی و همه‌کاره. تاریخ امروز: ${today}.`,
    userName ? `نام کاربر: ${userName}.` : "",
    "قوانین مهم:",
    "۱. همیشه با هویت «یارا» صحبت کن و هرگز نام مدل یا شرکت دیگری را به عنوان سازنده خودت نیاور.",
    "۲. طبیعی، روان، ساختارمند و کاربردی پاسخ بده (برای کدنویسی از بلوک کد استاندارد و برای توضیحات از تیتر و بولت مرتب استفاده کن).",
    "۳. اگر از چیزی مطمئن نیستی یا اطلاع لحظه‌ای در اختیار نداری، صادقانه بگو و اطلاعات ساختگی تولید نکن.",
  ];

  if (mode === "deep") {
    parts.push("حالت گفتگو: تحلیل عمیق و مهندسی. مسئله را گام‌به‌گام بررسی کن و کد یا راه‌حل کامل ارائه بده.");
  } else if (mode === "translate") {
    parts.push("حالت گفتگو: مترجم و ویراستار حرفه‌ای. متن را روان، دقیق و طبیعی ترجمه یا ویرایش کن.");
  } else if (mode === "general") {
    parts.push("حالت گفتگو: دستیار سریع. پاسخ کوتاه، شفاف و مستقیم بده.");
  } else {
    parts.push("حالت گفتگو: همه‌کاره و جامع با استفاده از منابع معتبر در دسترس.");
  }

  if (useWebSearch && wikiContext) {
    parts.push(
      `منابع دانشنامه‌ای زنده زیر برای کمک به دقت پاسخ پیدا شده‌اند (در صورت مرتبط بودن از آن‌ها استفاده کن):\n\n${wikiContext}`
    );
  }

  return parts.filter(Boolean).join("\n");
}

export async function generateStaticBrowserReply(
  prompt: string,
  attachments: Attachment[],
  history: ChatMessage[],
  options?: {
    mode?: AssistantMode;
    useWebSearch?: boolean;
    userName?: string;
    signal?: AbortSignal;
  }
): Promise<{ text: string; sources: GroundingSource[] }> {
  const clean = prompt.trim();
  const mode = options?.mode || "live";
  const useWebSearch = options?.useWebSearch ?? true;
  const sources: GroundingSource[] = [];

  // Fetch optional live Wikipedia grounding context when web search is enabled and query is informative
  let wikiContext = "";
  const isShortGreeting = /^(سلام|درود|خوبی|چطوری|hi|hello)[\s!؟?]*$/i.test(clean);
  if (useWebSearch && clean.length >= 3 && !isShortGreeting) {
    try {
      const faResults = await searchWikipediaCors("fa", clean);
      const enResults = faResults.length > 0 ? [] : await searchWikipediaCors("en", clean);
      const combined = [...faResults, ...enResults].slice(0, 2);
      if (combined.length > 0) {
        wikiContext = combined
          .map((item) => {
            sources.push({ title: `${item.title} — Wikipedia`, uri: item.uri });
            return `عنوان: ${item.title}\nلینک: ${item.uri}\nخلاصه: ${item.extract.slice(0, 800)}`;
          })
          .join("\n\n---\n\n");
      }
    } catch {
      // ignore search error and continue with LLM
    }
  }

  // Format attachments into prompt text
  const attachmentTextParts: string[] = [];
  for (const att of attachments) {
    const decoded = decodeAttachmentText(att);
    if (decoded) {
      attachmentTextParts.push(`[محتوای فایل ${att.name}]:\n\`\`\`\n${decoded}\n\`\`\``);
    } else {
      attachmentTextParts.push(
        `[پیوست رسانه‌ای ارسال‌شده توسط کاربر: ${att.name} (${att.mimeType}) — توجه: در این لحظه ابزار تحلیل مستقیم پیکسل تصویر فعال نیست؛ اگر کاربر درباره محتوای عکس پرسید، صادقانه اطلاع بده.]`
      );
    }
  }

  const userContent = [clean, ...attachmentTextParts].filter(Boolean).join("\n\n") || "سلام";

  const recentHistory = history
    .filter((m) => !m.isError && m.text.trim().length > 0)
    .slice(-10)
    .map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : ("user" as const),
      content: m.text.slice(0, 4000),
    }));

  const messages = [
    {
      role: "system" as const,
      content: buildStaticSystemPrompt(mode, useWebSearch, options?.userName, wikiContext),
    },
    ...recentHistory,
    { role: "user" as const, content: userContent },
  ];

  // Primary free CORS AI completion endpoint (keyless)
  try {
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai-fast",
        messages,
        temperature: mode === "deep" || mode === "translate" ? 0.3 : 0.7,
      }),
      signal: options?.signal ?? AbortSignal.timeout(25000),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const aiText = data.choices?.[0]?.message?.content?.trim();
      if (aiText) {
        return { text: aiText, sources };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    // fall through to offline/arithmetic/wiki fallback
  }

  // Fallback if AI endpoint temporarily unreachable
  const mathAns = trySafeArithmetic(clean);
  if (mathAns) return { text: mathAns, sources };

  if (wikiContext) {
    const readable = wikiContext
      .replace(/عنوان: /g, "### ")
      .replace(/لینک: [^\n]+\n/g, "")
      .replace(/خلاصه: /g, "");
    return { text: readable, sources };
  }

  return {
    text: "در این لحظه ارتباط با سرویس هوش مصنوعی با اختلال موقت مواجه شد. لطفاً چند ثانیه دیگر دوباره امتحان کنید.",
    sources: [],
  };
}
