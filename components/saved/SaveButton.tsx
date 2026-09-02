"use client";

import { useEffect, useState } from "react";
import { loadSaved, writeSaved } from "@/lib/saved-items";

export default function SaveButton<T extends object>({
  storageKey,
  itemKey,
  item,
  label = "검토함에 저장",
  savedLabel = "검토함에 저장됨",
  compact = false,
}: {
  storageKey: string;
  itemKey: keyof T;
  item: T;
  label?: string;
  savedLabel?: string;
  compact?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = String(item[itemKey]);

  useEffect(() => {
    // Read browser-only persistence after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(loadSaved<T>(storageKey).some((candidate) => String(candidate[itemKey]) === id));
    setMounted(true);
  }, [id, itemKey, storageKey]);

  function toggleSaved() {
    const items = loadSaved<T>(storageKey);
    if (saved) {
      writeSaved(storageKey, items.filter((candidate) => String(candidate[itemKey]) !== id));
      setSaved(false);
      return;
    }
    writeSaved(storageKey, [...items, item]);
    setSaved(true);
  }

  return (
    <button
      type="button"
      className={compact ? "review-save review-save--compact" : "review-save"}
      onClick={toggleSaved}
      disabled={!mounted}
      aria-pressed={saved}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      {saved ? savedLabel : label}
    </button>
  );
}
