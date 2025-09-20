"use client";

import { useEffect, useState } from "react";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning";
  duration?: number; // ms
};

type Listener = (toasts: Toast[]) => void;

const listeners = new Set<Listener>();
let queue: Toast[] = [];

function notify() {
  for (const l of listeners) l(queue);
}

function add(toast: Omit<Toast, "id">) {
  const item: Toast = {
    id: Math.random().toString(36).slice(2),
    duration: 2500,
    ...toast,
  };
  queue = [...queue, item];
  notify();
  // auto dismiss
  const d = item.duration ?? 2500;
  if (d > 0) setTimeout(() => dismiss(item.id), d);
}

export function dismiss(id: string) {
  queue = queue.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(queue);

  useEffect(() => {
    const l: Listener = (q) => setToasts(q);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  return {
    toasts,
    toast: (opts: Omit<Toast, "id">) => add(opts),
    dismiss,
  };
}

// Direct API for convenience usage without hook
export function toast(opts: Omit<Toast, "id">) {
  return add(opts);
}

export type { Toast as ToastItem };
