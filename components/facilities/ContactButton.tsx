"use client";

import { useRef, useState } from "react";

interface ContactButtonProps {
  facilityName: string;
  isHaccp: boolean;
}

function makeTemplate(facilityName: string): string {
  return `안녕하세요. ${facilityName}에 공동제조 문의드립니다.\n\n■ 개발 또는 제조 희망 제품: \n■ 희망 수량: \n■ 희망 일정: \n■ 스마트 HACCP 등록 필요 여부: \n■ 기타 요청사항: `.trim();
}

export default function ContactButton({ facilityName }: ContactButtonProps) {
  const [text, setText] = useState(() => makeTemplate(facilityName));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1000);
    } catch {
      setCopyState("fallback");
    }
  }

  return (
    <section className="contact-button-section" aria-labelledby="contact-section-title">
      <h2 id="contact-section-title">공동제조 문의</h2>
      <p className="contact-button-section__desc">
        아래 문의 내용을 작성하고 복사하여 직접 연락해 주세요. 내용은 저장되지 않습니다.
      </p>
      <textarea
        className="contact-button-section__template"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        aria-label="문의 내용"
      />
      <div className="contact-button-section__actions">
        <button
          type="button"
          className="button button--point"
          onClick={handleCopy}
          aria-live="polite"
        >
          {copyState === "copied" ? "복사되었습니다" : "문의내용 복사"}
        </button>
      </div>
      {copyState === "fallback" && (
        <div className="contact-button-section__fallback" role="alert">
          <p>클립보드 접근이 거부되었습니다. 아래 내용을 직접 선택하여 복사해 주세요.</p>
          <textarea
            ref={fallbackTextareaRef}
            className="contact-button-section__fallback-text"
            readOnly
            value={text}
            rows={10}
            aria-label="직접 복사용 문의 내용"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
      <p className="contact-button-section__notice">
        문의 내용은 저장·전송되지 않습니다. 업체에 직접 전화 또는 홈페이지를 통해 연락해 주세요.
      </p>
    </section>
  );
}
