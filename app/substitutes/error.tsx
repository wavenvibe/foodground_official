"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: ErrorProps) {
  return (
    <div className="app-shell">
      <div className="page-container">
        <div className="state-panel state-panel--error" role="alert">
          <p className="state-panel__title">페이지 오류가 발생했습니다</p>
          <p className="state-panel__desc">일시적인 문제일 수 있습니다. 다시 시도해 주세요.</p>
          <button className="button button--secondary" onClick={reset}>
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}
