export default function Loading() {
  return (
    <div className="app-shell">
      <div className="page-container">
        <div className="state-panel state-panel--neutral" role="status" aria-live="polite">
          <p>대체 식재료를 검색 중입니다…</p>
        </div>
      </div>
    </div>
  );
}
