"use client";

import { useRef, useState } from "react";

interface InquiryFormProps {
  facilityId: string;
  facilityName: string;
  ingredient: string;
  substitute: string;
  recipe: string;
  recipeName: string;
  sourceName: string;
  item: string;
  process: string;
}

function buildTemplate(props: InquiryFormProps): string {
  const { facilityName, ingredient, substitute, recipe, recipeName, sourceName, item, process } = props;
  const lines: string[] = [];
  lines.push(`안녕하세요. ${facilityName || "귀사"}에 공동제조 문의드립니다.`);
  lines.push("");
  if (recipe) lines.push(`■ 참고 레시피: ${recipeName || `레시피 #${recipe}`}`);
  if (ingredient) lines.push(`■ 주요 식재료: ${ingredient}`);
  if (substitute) lines.push(`■ 대체 식재료 후보: ${substitute}`);
  if (sourceName) lines.push(`■ 제품화 시작점: ${sourceName}`);
  lines.push(`■ 개발 또는 제조 희망 제품: ${item}`);
  if (process) lines.push(`■ 필수 공정·CCP: ${process}`);
  lines.push("■ 희망 수량: ");
  lines.push("■ 희망 일정: ");
  lines.push("■ HACCP 필요 여부: ");
  lines.push("■ 기타 요청사항: ");
  return lines.join("\n").trim();
}

export default function InquiryForm(props: InquiryFormProps) {
  const [text, setText] = useState(() => buildTemplate(props));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("fallback");
    }
  }

  return (
    <section className="contact-button-section" aria-labelledby="inquiry-form-title">
      <h2 id="inquiry-form-title">문의 내용 작성</h2>
      <p className="contact-button-section__desc">
        아래 내용을 수정하고 복사해 시설에 직접 연락해 주세요.
      </p>
      <textarea
        className="contact-button-section__template"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        aria-label="문의 내용"
      />
      <div className="contact-button-section__actions">
        <button
          type="button"
          className="button button--point"
          onClick={handleCopy}
          aria-live="polite"
        >
          {copyState === "copied" ? "복사되었습니다 ✓" : "문의내용 복사"}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setText(buildTemplate(props))}
        >
          초기화
        </button>
      </div>

      {copyState === "fallback" && (
        <div className="contact-button-section__fallback" role="alert">
          <p>클립보드 접근이 거부되었습니다. 아래 내용을 직접 선택해 복사하세요.</p>
          <textarea
            ref={fallbackRef}
            className="contact-button-section__fallback-text"
            readOnly
            value={text}
            rows={12}
            aria-label="직접 복사용 문의 내용"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}

      <p className="contact-button-section__notice">
        문의 내용은 저장·전송되지 않습니다. 업체에 직접 전화 또는 홈페이지로 연락해 주세요.
        이메일 주소를 추정하거나 자동 발송하지 않습니다.
      </p>
    </section>
  );
}
