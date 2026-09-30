import type { ReactNode } from "react";

/** "Nothing here yet" — distinct from a load error (use LoadError for those). */
export default function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="bx-empty">
      {icon && <div className="bx-empty-icon" aria-hidden="true">{icon}</div>}
      <p className="bx-empty-title">{title}</p>
      {children && <div className="bx-empty-sub">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
