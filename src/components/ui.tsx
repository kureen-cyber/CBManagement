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
    PENDING: "badge-warn",
    ACTIVE: "badge-ok",
    ON_HOLD: "badge-warn",
    AWAITING_FINAL_PAYMENT: "badge-warn",
    COMPLETED: "badge-info",
    CANCELLED: "badge-danger",
    PARTIAL: "badge-warn",
    PAID: "badge-ok",
    OVERDUE: "badge-danger",
    VOID: "badge-muted",
  };
  const labels: Record<string, string> = {
    AWAITING_FINAL_PAYMENT: "Awaiting final payment",
    PENDING: "Pending",
    ACTIVE: "Active",
    COMPLETED: "Completed",
    ON_HOLD: "On hold",
  };
  const label = labels[status] ?? status.replace(/_/g, " ");
  return (
    <span className={clsx("badge", map[status] ?? "badge-muted")}>
      {label}
    </span>
  );
}
