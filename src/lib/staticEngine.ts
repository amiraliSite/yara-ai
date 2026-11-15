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

export async function generateStaticBrowserReply(
  prompt: string,
  attachments: Attachment[],
  _history: ChatMessage[]
): Promise<{ text: string; sources: GroundingSource[] }> {
  const clean = prompt.trim();
  const sources: GroundingSource[] = [];

  // 1. Date / Time quick answers
  if (/تاریخ|امروز چندم|ساعت چنده|چند شنبه/.test(clean) && clean.length < 45) {
    const now = new Date();
    const faDate = now.toLocaleDateString("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const faTime = now.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
    return {
      text: `امروز **${faDate}** و ساعت اکنون **${faTime}** است.`,
      sources,
    };
  }

  // 2. Greeting quick answer
  if (/^(سلام|درود|سلام رفیق|خوبی|چطوری|hi|hello)[\s!؟?]*$/i.test(clean)) {
    return {
      text: "سلام! خوش اومدی. در حال حاضر اپلیکیشن در **حالت مرورگر (GitHub Pages)** اجرا شده؛ تمام حساب، گفتگوها و یادداشت‌های شما به‌صورت محلی در مرورگر ذخیره می‌شوند و پاسخ‌های دانشنامه‌ای به‌صورت زنده از ویکی‌پدیا دریافت می‌شوند.\n\nهر موضوعی می‌خوای بپرس (مثلاً «هوش مصنوعی چیه؟»، محاسبه ریاضی یا تاریخ امروز).",
      sources,
    };
  }

  // 3. Arithmetic check
  const mathAns = trySafeArithmetic(clean);
  if (mathAns) {
    return { text: mathAns, sources };
  }

  // 4. Local attachment inspection
  const attachmentNotes: string[] = [];
  for (const att of attachments) {
    if (att.data && (att.mimeType.startsWith("text/") || att.mimeType === "application/json")) {
      try {
        const bin = atob(att.data);
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        const decoded = new TextDecoder("utf-8").decode(bytes).slice(0, 1200);
        attachmentNotes.push(`**پیش‌نمایش فایل «${att.name}»:**\n\`\`\`\n${decoded}\n\`\`\``);
      } catch {
        attachmentNotes.push(`فایل متنی **${att.name}** دریافت شد.`);
      }
    } else {
      attachmentNotes.push(`فایل رسانه‌ای **${att.name}** (${att.mimeType}) در گفتگوی مرورگر پیوست شد.`);
    }
  }

  // 5. Live CORS Wikipedia search (Persian first, then English if needed)
  if (clean.length >= 2) {
    try {
      const faResults = await searchWikipediaCors("fa", clean);
      const enResults = faResults.length > 0 ? [] : await searchWikipediaCors("en", clean);
      const combined = [...faResults, ...enResults];

      if (combined.length > 0) {
        const blocks = combined.slice(0, 2).map((item) => {
          sources.push({ title: `${item.title} — Wikipedia`, uri: item.uri });
          return `### ${item.title}\n${item.extract}`;
        });

        const prefix = attachmentNotes.length > 0 ? `${attachmentNotes.join("\n\n")}\n\n` : "";
        return {
          text: `${prefix}${blocks.join("\n\n---\n\n")}\n\n> *پاسخ زنده از ویکی‌پدیا در حالت استاتیک GitHub Pages دریافت شد. برای تحلیل کامل فایل، کدنویسی پیشرفته و استریم Gemini باید سرور Node.js فعال باشد.*`,
          sources,
        };
      }
    } catch {
      // fall through gracefully
    }
  }

  if (attachmentNotes.length > 0) {
    return {
      text: `${attachmentNotes.join("\n\n")}\n\n> *در نسخه استاتیک GitHub Pages پردازش عمیق فایل و مدل Gemini سرور در دسترس نیست؛ برای تحلیل کامل با هوش مصنوعی از نسخه سروری برنامه استفاده کنید.*`,
      sources,
    };
  }

  return {
    text: "این نسخه روی **GitHub Pages (حالت استاتیک مرورگر)** اجرا شده است؛ به همین دلیل مدل هوش مصنوعی Gemini سرور در دسترس نیست.\n\n- برای سوال‌های دانشنامه‌ای می‌توانید عنوان یا کلیدواژه دقیق‌تری بنویسید تا مستقیماً از **ویکی‌پدیای فارسی/انگلیسی** برایتان جستجو شود.\n- تمام چت‌ها و یادداشت‌های شما همچنان در مرورگر ذخیره می‌شوند.",
    sources,
  };
}
