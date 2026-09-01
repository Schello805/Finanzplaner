export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-heading mt-1">{title}</h1><p className="mt-2 muted">{description}</p></div>{action}</header>;
}
