import React from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>حالت آفلاین — گفتگوها و یادداشت‌های ذخیره‌شده در دسترس هستند</span>
    </div>
  );
};
