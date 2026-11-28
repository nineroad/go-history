import { useState, type ReactNode } from "react";
import { useLocale } from "../i18n/context";
import { ApiError } from "../lib/api";

export function ErrorNotice({ error }: { error?: Error }) {
  const { t } = useLocale();
  if (!error) return null;
  return <p className="notice error" role="alert">{t("error")} <small>{error instanceof ApiError ? error.code : error.message}</small></p>;
}
export function Status({ loading, error, children }: { loading: boolean; error?: Error; children: ReactNode }) {
  const { t } = useLocale();
  if (loading) return <p role="status">{t("loading")}</p>;
  if (error) return <ErrorNotice error={error} />;
  return <>{children}</>;
}
export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const { t } = useLocale();
  if (total <= pageSize) return null;
  return <div className="pager">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("previous")}</button>
    <span>{page} / {Math.ceil(total / pageSize)}</span>
    <button disabled={page * pageSize >= total} onClick={() => onPage(page + 1)}>{t("next")}</button>
  </div>;
}
export function Share({ path }: { path: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error>();
  const url = new URL(path, window.location.origin).href;
  const encoded = encodeURIComponent(url);
  const links = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encoded}`],
    ["X", `https://twitter.com/intent/tweet?url=${encoded}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`],
  ];
  return <div className="share"><span>{t("share")}</span>
    {links.map(([name, href]) => <a key={name} href={href} target="_blank" rel="noopener noreferrer">{name}</a>)}
    <button onClick={() => {
      setError(undefined);
      navigator.clipboard.writeText(url).then(() => setCopied(true)).catch((failure: unknown) => setError(failure instanceof Error ? failure : new Error("COPY_FAILED")));
    }}>{copied ? t("copied") : t("copy")}</button>
    <ErrorNotice error={error} />
  </div>;
}
