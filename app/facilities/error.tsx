"use client";

import { useEffect } from "react";
import StatePanel from "@/components/StatePanel";

export default function FacilitiesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[facilities-page] unexpected render error", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="page-container">
      <StatePanel
        tone="error"
        title="화면을 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        traceId={error.digest}
        onAction={unstable_retry}
        actionLabel="다시 시도"
      />
    </main>
  );
}
