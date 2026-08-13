import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

export function Panel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={clsx("panel", className)} style={style}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "badge-muted",
    SENT: "badge-info",
    ACCEPTED: "badge-ok",
    REJECTED: "badge-danger",
    CONVERTED: "badge-ok",
    ACTIVE: "badge-ok",
    ON_HOLD: "badge-warn",
    COMPLETED: "badge-info",
    CANCELLED: "badge-danger",
    PARTIAL: "badge-warn",
    PAID: "badge-ok",
    OVERDUE: "badge-danger",
    VOID: "badge-muted",
  };
  return (
    <span className={clsx("badge", map[status] ?? "badge-muted")}>
      {status.replace("_", " ")}
    </span>
  );
}
