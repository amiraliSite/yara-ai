import React, { useState } from "react";
import {
  Plus,
  Trash2,
  MessageSquare,
  Bookmark,
  Sun,
  Moon,
  ExternalLink,
  X,
  LogOut,
} from "lucide-react";
import type { ChatSession, SavedNote, UserProfile } from "../types";
import { PWAInstallButton } from "./PWAInstallButton";

interface SidebarContentProps {
  user: UserProfile;
  sessions: ChatSession[];
  activeSessionId: string;
  notes: SavedNote[];
  isDark: boolean;
  onToggleTheme: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onUseNoteInChat: (note: SavedNote) => void;
  onLogout: () => void;
  onCloseMobile?: () => void;
}

export const SidebarContent: React.FC<SidebarContentProps> = ({
  user,
  sessions,
  activeSessionId,
  notes,
  isDark,
  onToggleTheme,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onDeleteNote,
  onUseNoteInChat,
  onLogout,
  onCloseMobile,
}) => {
  const [tab, setTab] = useState<"chats" | "notes">("chats");

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString("fa-IR", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const initial = user.fullName.trim().slice(0, 1) || "ی";

  return (
    <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          یارا
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={isDark ? "حالت روشن" : "حالت تاریک"}
            title={isDark ? "تغییر به حالت روشن" : "تغییر به حالت تاریک"}
          >
            {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              aria-label="بستن منو"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile?.();
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>گفتگوی جدید</span>
        </button>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => setTab("chats")}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === "chats"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span>گفتگوها</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("notes")}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === "notes"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 shrink-0" />
            <span>یادداشت‌ها ({notes.length})</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {tab === "chats" ? (
          sessions.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              هنوز گفتگویی ذخیره نشده است.
            </p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <li key={session.id}>
                    <div
                      className={`group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                        isActive
                          ? "bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSession(session.id);
                          onCloseMobile?.();
                        }}
                        className="min-w-0 flex-1 text-right"
                      >
                        <div className="truncate text-sm font-medium">{session.title}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{formatTime(session.updatedAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{session.messages.length} پیام</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSession(session.id)}
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 opacity-75 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="حذف گفتگو"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : notes.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
            می‌توانید پاسخ‌های مهم را ذخیره کنید تا در حساب شما و حتی به‌صورت آفلاین در دسترس باشند.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onUseNoteInChat(note);
                      onCloseMobile?.();
                    }}
                    className="min-w-0 flex-1 text-right"
                  >
                    <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {note.title}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {note.content}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    aria-label="حذف یادداشت"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {note.sources && note.sources.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-teal-700 dark:text-teal-400">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>{note.sources.length} منبع ذخیره شده</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* User Account + PWA Install Footer */}
      <div className="border-t border-slate-200 p-4 space-y-3 dark:border-slate-800">
        <PWAInstallButton variant="full" />

        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: user.avatarColor || "#0F766E" }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {user.fullName}
              </div>
              <div dir="ltr" className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {user.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            title="خروج از حساب"
            aria-label="خروج از حساب"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
