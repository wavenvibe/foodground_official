import Link from "next/link";

type StateTone = "neutral" | "error" | "warning" | "success";

interface StatePanelProps {
  title: string;
  description: string;
  tone?: StateTone;
  traceId?: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function StatePanel({
  title,
  description,
  tone = "neutral",
  traceId,
  actionHref,
  actionLabel,
  onAction,
}: StatePanelProps) {
  const role = tone === "error" || tone === "warning" ? "alert" : "status";

  return (
    <section className={`state-panel state-panel--${tone}`} role={role}>
      <h2>{title}</h2>
      <p>{description}</p>
      {traceId ? <p className="state-panel__trace">추적번호 {traceId}</p> : null}
      {actionHref && actionLabel ? (
        <Link className="button button--secondary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
      {onAction && actionLabel ? (
        <button className="button button--secondary" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
