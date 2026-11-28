import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import type { Comment, Page } from "../../../shared/contracts";
import { useLocale } from "../../i18n/context";
import { useMembership } from "../membership/context";
import { api } from "../../lib/api";
import { useResource } from "../../lib/use-resource";
import { ErrorNotice, Share, Status, Pager } from "../../components/common";

export function Discussion({ contentId }: { contentId: string }) {
  const { t, locale } = useLocale();
  const { member } = useMembership();
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Comment>>(`/comments?contentId=${encodeURIComponent(contentId)}&page=${page}`);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<Error>();
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(undefined); setSent(false);
    try { await api("/comments", { method: "POST", body: JSON.stringify({ contentId, body }) }); setBody(""); setSent(true); }
    catch (failure) { setError(failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  return <section className="discussion"><h2>{t("comments")}</h2>
    <Status {...resource}>
      {resource.data?.items.map((comment) => <article className="comment" key={comment.id} id={`comment-${comment.id}`}>
        <header><strong>{comment.author}</strong><time>{new Date(comment.createdAt).toLocaleString(locale)}</time></header>
        <p>{comment.body}</p><Link to={`/${locale}/comments/${comment.id}`}>{t("share")} →</Link>
      </article>)}
      {resource.data?.total === 0 && <p className="muted">{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={setPage} />}
    </Status>
    {member?.status === "approved" && member.emailVerified
      ? <form onSubmit={submit}><label>{t("comments")}<textarea required maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("commentHint")} /></label><button className="primary" disabled={busy}>{t("submit")}</button></form>
      : <p className="notice">{t("memberNotice")} <Link to={`/${locale}/account`}>{t("account")}</Link></p>}
    {sent && <p role="status" className="notice">{t("pendingNotice")}</p>}<ErrorNotice error={error} />
  </section>;
}
export function CommentPage() {
  const { id = "" } = useParams();
  const { locale, t } = useLocale();
  const resource = useResource<Comment>(`/comments/${encodeURIComponent(id)}`);
  return <section className="section prose"><Status {...resource}>{resource.data && <>
    <h1>{t("comments")}</h1><p className="eyebrow">{resource.data.author} · {new Date(resource.data.createdAt).toLocaleString(locale)}</p>
    <p>{resource.data.body}</p><Link to={`/${locale}/content/${resource.data.contentId}`}>{t("read")}</Link><Share path={`/${locale}/comments/${id}`} />
  </>}</Status></section>;
}
