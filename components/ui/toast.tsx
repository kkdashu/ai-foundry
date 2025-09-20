"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useToast, dismiss } from "./use-toast";

export function Toaster() {
  const { toasts } = useToast();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-md px-3 py-2 text-sm shadow-md",
            "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70",
            t.variant === "destructive" && "bg-red-600 text-white",
            t.variant === "success" && "bg-green-600 text-white",
            t.variant === "warning" && "bg-yellow-600 text-white"
          )}
          onClick={() => dismiss(t.id)}
        >
          {t.title && <div className="font-medium">{t.title}</div>}
          {t.description && <div className="opacity-90">{t.description}</div>}
          {!t.title && !t.description && <div>通知</div>}
        </div>
      ))}
    </div>,
    document.body
  );
}
