import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Menu,
  Plus,
  Send,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Mic,
  Square,
  Globe,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Bookmark,
  ExternalLink,
  X,
  FileText,
  Loader2,
  Compass,
  Code2,
  Languages,
  Zap,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import type {
  AssistantMode,
  Attachment,
  ChatMessage,
  ChatSession,
  GroundingSource,
  SavedNote,
  UserProfile,
} from "./types";
import { SidebarContent } from "./components/SidebarContent";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { AuthScreen } from "./components/AuthScreen";
import { Splash3DLoader } from "./components/Splash3DLoader";
import { apiFetch, getStoredToken, setStoredToken } from "./lib/api";

const STORAGE_USER_KEY = "yara_ai_cached_user_v1";
const STORAGE_THEME_KEY = "yara_ai_theme_v1";

function cacheKeySessions(userId: string) {
  return `yara_ai_sessions_${userId}_v1`;
}

function cacheKeyNotes(userId: string) {
  return `yara_ai_notes_${userId}_v1`;
}

const MODE_OPTIONS: Array<{
  id: AssistantMode;
  label: string;
  description: string;
}> = [
  { id: "live", label: "وب زنده", description: "جواب واقعی با جستجوی گوگل و بررسی لینک" },
  { id: "deep", label: "تحلیل و کد", description: "تفکر عمیق برای برنامه‌نویسی و مسائل پیچیده" },
  { id: "translate", label: "مترجم", description: "ترجمه دقیق و ویرایش روان فارسی و انگلیسی" },
  { id: "general", label: "سریع", description: "پاسخ کوتاه، مستقیم و کاربردی" },
];

const QUICK_STARTERS = [
  {
    title: "خبر و اطلاعات واقعی روز",
    prompt: "مهم‌ترین خبرهای فناوری و هوش مصنوعی این هفته در دنیا چیه؟ با منبع بگو.",
    mode: "live" as AssistantMode,
    icon: Compass,
  },
  {
    title: "برنامه‌نویسی و رفع خطا",
    prompt: "یک تابع پایتون تمیز بنویس که فایل‌های تکراری یک پوشه رو بر اساس هش پیدا کنه.",
    mode: "deep" as AssistantMode,
    icon: Code2,
  },
  {
    title: "ترجمه و نگارش حرفه‌ای",
    prompt: "این پیام رو به انگلیسی رسمی و مودبانه ترجمه کن: سلام، ممنون می‌شم زمان جلسه فردا رو تایید کنید.",
    mode: "translate" as AssistantMode,
    icon: Languages,
  },
  {
    title: "خلاصه‌سازی و ایده‌پردازی",
    prompt: "چطور می‌تونم با روزی ۳۰ دقیقه مطالعه، زبان انگلیسی‌م رو سریع‌تر تقویت کنم؟ برنامه عملی بده.",
    mode: "general" as AssistantMode,
    icon: Zap,
  },
];

function createEmptySession(mode: AssistantMode = "live"): ChatSession {
  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: "گفتگوی جدید",
    mode,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("خطا در پردازش صدا"));
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  const [showSplash, setShowSplash] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([createEmptySession("live")]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [notes, setNotes] = useState<SavedNote[]>([]);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteMsgId, setSavedNoteMsgId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createEmptySession();

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem(STORAGE_THEME_KEY, isDark ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [isDark]);

  const hydrateFromServer = useCallback(async (profile: UserProfile) => {
    try {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }

    // Load cached offline state immediately while fetching fresh DB rows
    try {
      const cachedSessionsRaw = localStorage.getItem(cacheKeySessions(profile.id));
      if (cachedSessionsRaw) {
        const cached = JSON.parse(cachedSessionsRaw) as ChatSession[];
        if (Array.isArray(cached) && cached.length > 0) {
          setSessions(cached);
          setActiveSessionId(cached[0].id);
        }
      }
      const cachedNotesRaw = localStorage.getItem(cacheKeyNotes(profile.id));
      if (cachedNotesRaw) {
        const cachedNotes = JSON.parse(cachedNotesRaw) as SavedNote[];
        if (Array.isArray(cachedNotes)) setNotes(cachedNotes);
      }
    } catch {
      // ignore cache parse errors
    }

    try {
      const [chatsRes, notesRes] = await Promise.all([
        apiFetch("/api/chats"),
        apiFetch("/api/notes"),
      ]);

      if (chatsRes.ok) {
        const chatsData = (await chatsRes.json()) as { sessions?: ChatSession[] };
        if (Array.isArray(chatsData.sessions) && chatsData.sessions.length > 0) {
          setSessions(chatsData.sessions);
          setActiveSessionId(chatsData.sessions[0].id);
        }
      }
      if (notesRes.ok) {
        const notesData = (await notesRes.json()) as { notes?: SavedNote[] };
        if (Array.isArray(notesData.notes)) {
          setNotes(notesData.notes);
        }
      }
    } catch {
      // Keep cached offline data if server unreachable
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data = (await res.json()) as { user?: UserProfile };
          if (!cancelled && data.user) {
            setUser(data.user);
            await hydrateFromServer(data.user);
            setAuthChecking(false);
            return;
          }
        }
        if (res.status === 401) {
          setStoredToken(null);
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      } catch {
        // Offline fallback: if user previously logged in and device is offline, allow reading cached state
        if (!navigator.onLine && getStoredToken()) {
          try {
            const cachedUser = localStorage.getItem(STORAGE_USER_KEY);
            if (cachedUser) {
              const parsed = JSON.parse(cachedUser) as UserProfile;
              if (!cancelled) {
                setUser(parsed);
                await hydrateFromServer(parsed);
              }
            }
          } catch {
            // ignore
          }
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromServer]);

  // Keep offline cache synchronized for logged-in user
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(cacheKeySessions(user.id), JSON.stringify(sessions));
    } catch {
      // ignore
    }
  }, [sessions, user]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(cacheKeyNotes(user.id), JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages.length, isGenerating]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      activeAudioRef.current?.pause();
    };
  }, []);

  const handleAuthenticated = async (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    await hydrateFromServer(loggedInUser);
  };

  const handleLogout = async () => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
    }
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setStoredToken(null);
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    setSessions([createEmptySession("live")]);
    setNotes([]);
    setActiveSessionId("");
    setIsDrawerOpen(false);
  };

  const updateSession = (sessionId: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? updater(s) : s)));
  };

  const handleNewChat = async () => {
    if (isGenerating) {
      abortControllerRef.current?.abort();
      setIsGenerating(false);
    }
    const fresh = createEmptySession(activeSession.mode);
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setAttachments([]);
    setStatusError(null);

    try {
      await apiFetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fresh.id, title: fresh.title, mode: fresh.mode }),
      });
    } catch {
      // ignore offline creation; /api/chat will upsert session when sending
    }
  };

  const handleDeleteSession = async (id: string) => {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptySession("live");
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (id === activeSession.id) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });

    try {
      await apiFetch(`/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  };

  const handleModeChange = async (mode: AssistantMode) => {
    updateSession(activeSession.id, (s) => ({ ...s, mode }));
    if (mode === "translate") {
      setUseWebSearch(false);
    } else if (mode === "live") {
      setUseWebSearch(true);
    }
    try {
      await apiFetch(`/api/chats/${encodeURIComponent(activeSession.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
    } catch {
      // ignore
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setShowAttachMenu(false);
    if (files.length === 0) return;

    setStatusError(null);
    const added: Attachment[] = [];

    for (const file of files.slice(0, 4)) {
      if (file.size > 10 * 1024 * 1024) {
        setStatusError(`فایل «${file.name}» بیشتر از ۱۰ مگابایت است.`);
        continue;
      }
      try {
        const data = await fileToBase64(file);
        const mimeType = file.type || "text/plain";
        const previewUrl = mimeType.startsWith("image/") ? `data:${mimeType};base64,${data}` : undefined;
        added.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType,
          data,
          previewUrl,
        });
      } catch {
        setStatusError("امکان خواندن یکی از فایل‌ها وجود نداشت.");
      }
    }

    if (added.length > 0) {
      setAttachments((prev) => [...prev, ...added].slice(0, 4));
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const startOrStopRecording = async () => {
    setStatusError(null);

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatusError("مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size < 500) return;

        setIsTranscribing(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const response = await apiFetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64,
              mimeType: recorder.mimeType || "audio/webm",
            }),
          });
          const data = (await response.json()) as { text?: string; error?: string };
          if (!response.ok) {
            throw new Error(data.error || "تبدیل صدا به متن ناموفق بود.");
          }
          if (data.text) {
            setInput((prev) => (prev ? `${prev} ${data.text}` : data.text || ""));
            textareaRef.current?.focus();
          }
        } catch (err) {
          setStatusError(err instanceof Error ? err.message : "خطا در تبدیل گفتار به متن.");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setRecordSeconds(0);
      setIsRecording(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setStatusError("دسترسی به میکروفون داده نشد. لطفاً اجازه میکروفون را در مرورگر فعال کنید.");
    }
  };

  const handleSend = async (overrideText?: string, overrideMode?: AssistantMode) => {
    const textToSend = (overrideText ?? input).trim();
    if ((!textToSend && attachments.length === 0) || isGenerating) return;

    setStatusError(null);
    setShowAttachMenu(false);

    const targetSessionId = activeSession.id;
    const modeToUse = overrideMode || activeSession.mode;
    const userMsgId = `msg_${Date.now()}_u`;
    const assistantMsgId = `msg_${Date.now()}_a`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: textToSend,
      createdAt: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: "model",
      text: "",
      createdAt: Date.now(),
    };

    const nextTitle =
      activeSession.messages.length === 0
        ? (textToSend || attachments[0]?.name || "گفتگوی جدید").slice(0, 42)
        : activeSession.title;

    const historyForApi = [...activeSession.messages, userMsg]
      .filter((m) => !m.isError && (m.text.trim().length > 0 || (m.attachments && m.attachments.length > 0)))
      .map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        attachments: m.attachments
          ?.filter((a) => Boolean(a.data))
          .map((a) => ({
            id: a.id,
            mimeType: a.mimeType,
            data: a.data as string,
            name: a.name,
          })),
      }));

    updateSession(targetSessionId, (s) => ({
      ...s,
      title: nextTitle,
      mode: modeToUse,
      updatedAt: Date.now(),
      messages: [...s.messages, userMsg, placeholderAssistant],
    }));

    if (!overrideText) setInput("");
    setAttachments([]);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: targetSessionId,
          userMessageId: userMsgId,
          assistantMessageId: assistantMsgId,
          messages: historyForApi,
          mode: modeToUse,
          useWebSearch: overrideMode ? overrideMode === "live" || overrideMode === "deep" : useWebSearch,
        }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        await handleLogout();
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error("پاسخی از سرور دریافت نشد.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;

          try {
            const parsed = JSON.parse(line.slice(6)) as {
              type: "chunk" | "sources" | "done" | "error";
              text?: string;
              sources?: GroundingSource[];
              queries?: string[];
              message?: string;
            };

            if (parsed.type === "chunk" && parsed.text) {
              updateSession(targetSessionId, (s) => ({
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, text: m.text + parsed.text } : m
                ),
              }));
            } else if (parsed.type === "sources") {
              updateSession(targetSessionId, (s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, sources: parsed.sources, queries: parsed.queries }
                    : m
                ),
              }));
            } else if (parsed.type === "error") {
              updateSession(targetSessionId, (s) => ({
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        text: m.text || parsed.message || "خطا در دریافت پاسخ.",
                        isError: true,
                      }
                    : m
                ),
              }));
            }
          } catch {
            // ignore partial JSON chunks
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // stopped by user
      } else {
        updateSession(targetSessionId, (s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: "اتصال برقرار نشد. لطفاً وضعیت اینترنت خود را بررسی کنید و دوباره تلاش کنید.",
                  isError: true,
                }
              : m
          ),
        }));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const handleSaveNote = async (msg: ChatMessage) => {
    const firstLine = msg.text.split("\n").find((l) => l.trim().length > 0) || "یادداشت ذخیره شده";
    const title = firstLine.replace(/[#*`]/g, "").trim().slice(0, 60);
    const note: SavedNote = {
      id: `note_${Date.now()}`,
      title,
      content: msg.text,
      createdAt: Date.now(),
      sources: msg.sources,
    };
    setNotes((prev) => [note, ...prev]);
    setSavedNoteMsgId(msg.id);
    setTimeout(() => setSavedNoteMsgId(null), 2000);

    try {
      await apiFetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      });
    } catch {
      // ignore offline
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    try {
      await apiFetch(`/api/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  };

  const handleRetryFromError = async (errorMsgId: string) => {
    if (isGenerating) return;
    const idx = activeSession.messages.findIndex((m) => m.id === errorMsgId);
    if (idx <= 0) return;
    const prevUserMsg = [...activeSession.messages.slice(0, idx)]
      .reverse()
      .find((m) => m.role === "user");
    if (!prevUserMsg) return;

    updateSession(activeSession.id, (s) => ({
      ...s,
      messages: s.messages.filter((m) => m.id !== errorMsgId && m.id !== prevUserMsg.id),
    }));

    try {
      await Promise.all([
        apiFetch(`/api/chats/${encodeURIComponent(activeSession.id)}/messages/${encodeURIComponent(errorMsgId)}`, {
          method: "DELETE",
        }),
        apiFetch(`/api/chats/${encodeURIComponent(activeSession.id)}/messages/${encodeURIComponent(prevUserMsg.id)}`, {
          method: "DELETE",
        }),
      ]);
    } catch {
      // ignore
    }

    setTimeout(() => {
      if (prevUserMsg.attachments && prevUserMsg.attachments.length > 0) {
        setAttachments(prevUserMsg.attachments);
      }
      handleSend(prevUserMsg.text || "لطفاً فایل پیوست‌شده را بررسی کن.", activeSession.mode);
    }, 50);
  };

  const handlePlayTTS = async (msg: ChatMessage) => {
    if (ttsPlayingId === msg.id) {
      activeAudioRef.current?.pause();
      activeAudioRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setTtsPlayingId(null);
      return;
    }

    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setTtsPlayingId(null);
    setTtsLoadingId(msg.id);
    setStatusError(null);

    try {
      const response = await apiFetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.text }),
      });
      const data = (await response.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || "پخش صوتی ناموفق بود.");
      }

      const audio = new Audio(`data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`);
      activeAudioRef.current = audio;
      setTtsPlayingId(msg.id);
      audio.onended = () => {
        setTtsPlayingId(null);
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        setTtsPlayingId(null);
        activeAudioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const cleanText = msg.text.replace(/```[\s\S]*?```/g, "").replace(/[#*_`>~]/g, "").slice(0, 1200);
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = /[\u0600-\u06FF]/.test(cleanText) ? "fa-IR" : "en-US";
        utter.onend = () => setTtsPlayingId(null);
        utter.onerror = () => setTtsPlayingId(null);
        setTtsPlayingId(msg.id);
        window.speechSynthesis.speak(utter);
      } else {
        setStatusError(err instanceof Error ? err.message : "خطا در پخش صوتی.");
      }
    } finally {
      setTtsLoadingId(null);
    }
  };

  const handleUseNoteInChat = (note: SavedNote) => {
    setInput(`بر اساس این یادداشت ذخیره شده پاسخ بده:\n${note.content.slice(0, 1200)}`);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (showSplash) {
    return <Splash3DLoader onComplete={() => setShowSplash(false)} />;
  }

  if (authChecking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
          <span>در حال آماده‌سازی حساب یارا...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const currentModeInfo =
    MODE_OPTIONS.find((m) => m.id === activeSession.mode) || MODE_OPTIONS[0];

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block lg:w-72 lg:shrink-0 lg:border-l lg:border-slate-200 dark:lg:border-slate-800">
        <SidebarContent
          user={user}
          sessions={sessions}
          activeSessionId={activeSession.id}
          notes={notes}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onNewChat={handleNewChat}
          onSelectSession={setActiveSessionId}
          onDeleteSession={handleDeleteSession}
          onDeleteNote={handleDeleteNote}
          onUseNoteInChat={handleUseNoteInChat}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="h-full w-[82%] max-w-xs shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent
              user={user}
              sessions={sessions}
              activeSessionId={activeSession.id}
              notes={notes}
              isDark={isDark}
              onToggleTheme={() => setIsDark((d) => !d)}
              onNewChat={handleNewChat}
              onSelectSession={setActiveSessionId}
              onDeleteSession={handleDeleteSession}
              onDeleteNote={handleDeleteNote}
              onUseNoteInChat={handleUseNoteInChat}
              onLogout={handleLogout}
              onCloseMobile={() => setIsDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineIndicator />

        {/* Compact Top Bar (<= 56px on mobile) */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-3 sm:px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 lg:hidden">
              یارا
            </span>
            <span className="hidden lg:inline-block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {activeSession.title}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="lg:hidden">
              <PWAInstallButton variant="compact" />
            </div>
            <button
              type="button"
              onClick={handleNewChat}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>گفتگوی جدید</span>
            </button>
          </div>
        </header>

        {/* Scrollable Message Canvas */}
        <main className="flex-1 overflow-y-auto px-3 py-5 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {activeSession.messages.length === 0 ? (
              <div className="py-6 sm:py-12">
                <div className="mx-auto max-w-xl text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                    سلام {user.fullName}، چطور کمکت کنم؟
                  </h1>
                  <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
                    جستجوی زنده وب با ذکر منبع · تحلیل عکس و فایل · ورودی صوتی · ذخیره خودکار در حساب شخصی
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {QUICK_STARTERS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => handleSend(item.prompt, item.mode)}
                        className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-right transition-colors hover:border-teal-500/60 hover:bg-teal-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-500/50 dark:hover:bg-slate-800/80"
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <Icon className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                          <span>{item.title}</span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {item.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {activeSession.messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const timeStr = new Date(msg.createdAt).toLocaleTimeString("fa-IR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tr-sm bg-teal-700 px-4 py-3 text-white dark:bg-teal-700">
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-2">
                              {msg.attachments.map((att) =>
                                att.previewUrl ? (
                                  <img
                                    key={att.id}
                                    src={att.previewUrl}
                                    alt={att.name}
                                    referrerPolicy="no-referrer"
                                    className="h-28 w-28 rounded-xl object-cover border border-white/20"
                                  />
                                ) : (
                                  <div
                                    key={att.id}
                                    className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs"
                                  >
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    <span className="max-w-[140px] truncate">{att.name}</span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                          {msg.text && (
                            <p className="whitespace-pre-wrap text-[15px] leading-[1.7]">{msg.text}</p>
                          )}
                          <div className="mt-1.5 text-[11px] text-teal-100/80 tabular-nums">
                            {timeStr}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <article
                      key={msg.id}
                      className={`rounded-2xl border p-4 sm:p-5 ${
                        msg.isError
                          ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">یارا</span>
                          <span aria-hidden="true">·</span>
                          <span>{timeStr}</span>
                          {msg.sources && msg.sources.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-teal-700 dark:text-teal-400">
                                {msg.sources.length} منبع معتبر
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {msg.text ? (
                        <MarkdownRenderer content={msg.text} />
                      ) : (
                        <div className="flex items-center gap-2 py-2 text-sm text-slate-500 dark:text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                          <span>در حال بررسی و نوشتن پاسخ واقعی...</span>
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            منابع بررسی‌شده از وب:
                          </div>
                          <ul className="space-y-1.5">
                            {msg.sources.slice(0, 6).map((src) => (
                              <li key={src.uri}>
                                <a
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-teal-700 hover:underline dark:text-teal-400"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{src.title}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {msg.text && !msg.isError && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-teal-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            <span>{copiedId === msg.id ? "کپی شد" : "کپی"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePlayTTS(msg)}
                            disabled={ttsLoadingId === msg.id}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            {ttsLoadingId === msg.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : ttsPlayingId === msg.id ? (
                              <VolumeX className="h-3.5 w-3.5 text-teal-600" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {ttsLoadingId === msg.id
                                ? "آماده‌سازی صدا..."
                                : ttsPlayingId === msg.id
                                  ? "توقف صدا"
                                  : "شنیدن"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveNote(msg)}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          >
                            {savedNoteMsgId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-teal-600" />
                            ) : (
                              <Bookmark className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {savedNoteMsgId === msg.id ? "ذخیره شد" : "ذخیره در یادداشت"}
                            </span>
                          </button>
                        </div>
                      )}

                      {msg.isError && (
                        <div className="mt-3 flex items-center gap-2 border-t border-rose-200/70 pt-3 dark:border-rose-900/50">
                          <button
                            type="button"
                            onClick={() => handleRetryFromError(msg.id)}
                            disabled={isGenerating}
                            className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>تلاش مجدد</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* Thumb-Zone Composer */}
        <footer className="shrink-0 border-t border-slate-200 bg-white/95 px-3 pt-2.5 pb-safe sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto max-w-3xl space-y-2.5">
            {statusError && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{statusError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusError(null)}
                  className="p-1 hover:opacity-75"
                  aria-label="بستن خطا"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Mode Segmented Bar + Web Search Toggle */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
              <div
                className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
                role="tablist"
                aria-label="حالت دستیار"
              >
                {MODE_OPTIONS.map((opt) => {
                  const active = activeSession.mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      title={opt.description}
                      onClick={() => handleModeChange(opt.id)}
                      className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setUseWebSearch((v) => !v)}
                aria-pressed={useWebSearch}
                title={currentModeInfo.description}
                className={`flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  useWebSearch
                    ? "border-teal-600/40 bg-teal-50 text-teal-800 dark:border-teal-500/40 dark:bg-teal-950/50 dark:text-teal-300"
                    : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span>{useWebSearch ? "جستجوی وب روشن" : "جستجوی وب خاموش"}</span>
              </button>
            </div>

            {/* Selected Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pr-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {att.previewUrl ? (
                      <img
                        src={att.previewUrl}
                        alt={att.name}
                        className="h-9 w-9 rounded-lg object-cover"
                      />
                    ) : (
                      <FileText className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    )}
                    <span className="max-w-[120px] truncate text-slate-700 dark:text-slate-200">
                      {att.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label="حذف پیوست"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Main Composer Box */}
            <div className="relative flex items-end gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-teal-600 dark:border-slate-700 dark:bg-slate-800/70 dark:focus-within:border-teal-500">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.json,.csv,.py,.js,.ts,.tsx,.html,.css"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFilesSelected}
                className="hidden"
              />

              {showAttachMenu && (
                <div className="absolute right-0 bottom-14 z-30 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Camera className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>گرفتن عکس با دوربین</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ImageIcon className="h-4 w-4 text-teal-600 shrink-0" />
                    <span>انتخاب عکس یا فایل</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAttachMenu((v) => !v)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="پیوست عکس یا فایل"
                title="ارسال عکس، دوربین یا فایل"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={startOrStopRecording}
                disabled={isTranscribing}
                className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isRecording
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
                aria-label={isRecording ? "توقف ضبط صدا" : "ورودی صوتی"}
                title={isRecording ? "توقف ضبط" : "صحبت با دستیار"}
              >
                {isTranscribing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                ) : isRecording ? (
                  <Square className="h-4 w-4 fill-current" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRecording
                    ? `در حال ضبط صدا (${recordSeconds} ثانیه)... برای توقف بزنید`
                    : isTranscribing
                      ? "در حال تبدیل صدا به متن..."
                      : "هر سوالی داری بپرس، لینک بده یا عکس بفرست..."
                }
                className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 px-1 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              />

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGenerating}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                  aria-label="توقف پاسخ"
                  title="توقف"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() && attachments.length === 0}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white transition-colors hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-500 dark:bg-teal-600 dark:hover:bg-teal-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                  aria-label="ارسال پیام"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
