import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { contentInput, historyOf, locales, translated, type ContentInput, type Content, type Member, type Comment, type Page, type Locale, type Translation } from "../../../shared/contracts";
import { contentKinds, regions, themes } from "../../../shared/history";
import { useHistoryLabels } from "../../i18n/history";
import { HistoryFields } from "./history-fields";
import { useLocale, languageNames } from "../../i18n/context";
import { useMembership } from "../membership/context";
import { api } from "../../lib/api";
import { useResource } from "../../lib/use-resource";
import { ErrorNotice, Pager, Status } from "../../components/common";

function Members() {
  const { t } = useLocale();
  const membership = useMembership();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Member>>(`/admin/members?q=${encodeURIComponent(q)}&page=${page}`);
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault(); setError(undefined); setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await api(`/admin/members/${id}`, { method: "PATCH", body: JSON.stringify({ role: data.get("role"), status: data.get("status") }) });
      resource.reload(); membership.reload();
    } catch (failure) { setError(failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  return <>
    <label>{t("search")}<input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
    <ErrorNotice error={error} /><Status {...resource}>
      {resource.data?.items.map((member) => <form className="admin-row" key={member.id} onSubmit={(e) => save(e, member.id)}>
        <div><strong>{member.name}</strong><p>{member.email}</p><small>{t(member.emailVerified ? "verified" : "unverified")}</small></div>
        <label>{t("role")}<select name="role" defaultValue={member.role}><option value="member">{t("member")}</option><option value="admin">{t("admin")}</option></select></label>
        <label>{t("status")}<select name="status" defaultValue={member.status}>{(["pending", "approved", "suspended"] as const).map((status) => <option key={status} value={status}>{t(status)}</option>)}</select></label>
        <button disabled={busy}>{t("save")}</button>
      </form>)}
      {resource.data?.total === 0 && <p>{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={setPage} />}
    </Status>
  </>;
}

function Moderation() {
  const { t, locale } = useLocale();
  const [filters, setFilters] = useState({ q: "", status: "pending", author: "", contentId: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const resource = useResource<Page<Comment>>(`/admin/comments?${query}`);
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  async function change(id: string, status: string) {
    if (status === "deleted" && !window.confirm(t("confirmDelete"))) return;
    setError(undefined); setBusy(true);
    try { await api(`/admin/comments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); resource.reload(); }
    catch (failure) { setError(failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  return <>
    <div className="filters admin-filters">
      {(["q", "author", "contentId", "from", "to"] as const).map((key) => <label key={key}>{t(key === "q" ? "search" : key === "contentId" ? "content" : key)}<input type={key === "from" || key === "to" ? "date" : "text"} value={filters[key]} onChange={(e) => { setFilters({ ...filters, [key]: e.target.value }); setPage(1); }} /></label>)}
      <label>{t("status")}<select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}><option value="">{t("allCategories")}</option>{(["pending", "approved", "hidden"] as const).map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    </div><ErrorNotice error={error} /><Status {...resource}>
      {resource.data?.items.map((comment) => <article className="comment" key={comment.id}><header><strong>{comment.author}</strong><span>{t(comment.status)} · {new Date(comment.createdAt).toLocaleDateString(locale)}</span></header><p>{comment.body}</p><Link to={`/${locale}/content/${comment.contentId}`}>{t("read")}</Link><div className="actions">
        <button disabled={busy} onClick={() => change(comment.id, "approved")}>{t("approve")}</button>
        <button disabled={busy} onClick={() => change(comment.id, "hidden")}>{t("hide")}</button>
        <button disabled={busy} onClick={() => change(comment.id, "deleted")}>{t("remove")}</button>
      </div></article>)}
      {resource.data?.total === 0 && <p>{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={setPage} />}
    </Status>
  </>;
}

const blankTranslation: Translation = { title: "", summary: "", body: "" };
const blankContent: ContentInput = {
  kind: "news", translations: { en: blankTranslation }, published: false, year: null,
  dateLabel: "", region: "World", category: "Community", sources: [],
};

function Editor({ item, onDone }: { item: Content | null; onDone: () => void }) {
  const { t } = useLocale();
  const h = useHistoryLabels();
  const [draft, setDraft] = useState<ContentInput>(item ?? blankContent);
  const [language, setLanguage] = useState<Locale>("en");
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const text = draft.translations[language] ?? blankTranslation;
  function setText(key: keyof Translation, value: string) {
    const history = historyOf(draft);
    setDraft({ ...draft, translations: { ...draft.translations, [language]: { ...text, [key]: value } },
      history: { ...history, editorialStatus: "draft", translationReview: { ...history.translationReview, [language]: "draft" } },
    });
  }
  function setSources(sources: ContentInput["sources"]) {
    setDraft((current) => ({ ...current, sources, history: { ...historyOf(current), editorialStatus: "draft" } }));
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setError(undefined); setBusy(true);
    try {
      const translations = { ...draft.translations };
      for (const locale of locales) {
        const value = translations[locale];
        if (locale !== "en" && value && !value.title.trim() && !value.summary.trim() && !value.body.trim()) delete translations[locale];
      }
      const history = historyOf(draft);
      const translationReview = { ...history.translationReview };
      for (const key of locales) if (!translations[key]) delete translationReview[key];
      const input = contentInput.parse({ ...draft, translations, history: { ...history, translationReview } });
      await api(item ? `/admin/content/${item.id}` : "/admin/content", { method: item ? "PUT" : "POST", body: JSON.stringify({ ...input, ...(item ? { revision: item.revision } : {}) }) });
      onDone();
    } catch (failure) { setError(failure instanceof z.ZodError ? new Error(failure.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")) : failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  return <form className="editor" onSubmit={save}>
    <div className="section-heading"><h2>{t(item ? "edit" : "newContent")}</h2><button type="button" onClick={onDone}>{t("close")}</button></div>
    <div className="filters">
      <label>{t("kind")}<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: z.enum(contentKinds).parse(e.target.value) })}>{contentKinds.map((value) => <option key={value} value={value}>{h(value)}</option>)}</select></label>
      <label>{t("language")}<select value={language} onChange={(e) => setLanguage(z.enum(locales).parse(e.target.value))}>{locales.map((value) => <option key={value} value={value}>{languageNames[value]}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} />{t("published")}</label>
    </div><p className="muted">{t("optionalTranslation")}</p>
    <label>{t("title")}<input value={text.title} maxLength={180} onChange={(e) => setText("title", e.target.value)} /></label>
    <label>{t("summary")}<textarea value={text.summary} maxLength={500} onChange={(e) => setText("summary", e.target.value)} /></label>
    <label>{t("body")}<textarea className="body-editor" value={text.body} maxLength={20000} onChange={(e) => setText("body", e.target.value)} /></label>
    <label>{t("dateLabel")}<input value={text.dateLabel ?? ""} maxLength={120} onChange={(e) => setText("dateLabel", e.target.value)} /></label>
    <div className="filters">
      <label>{h("startYear")}<input type="number" value={draft.year ?? ""} onChange={(e) => {
        const year = e.target.value ? Number(e.target.value) : null;
        const history = historyOf(draft);
        setDraft({ ...draft, year, history: { ...history, editorialStatus: "draft", dates: year === null ? null : { start: year, end: history.dates?.end ?? null, precision: history.dates?.precision ?? "unspecified" } } });
      }} /></label>
      <label>{t("dateLabel")}<input value={draft.dateLabel} onChange={(e) => setDraft({ ...draft, dateLabel: e.target.value, history: { ...historyOf(draft), editorialStatus: "draft" } })} /></label>
      <label>{t("allRegions")}<select value={draft.region} onChange={(e) => {
        const region = z.enum(regions).parse(e.target.value); const history = historyOf(draft);
        setDraft({ ...draft, region, history: { ...history, editorialStatus: "draft", regions: [...new Set([...history.regions, region])] } });
      }}>{regions.map((value) => <option key={value} value={value}>{h(value)}</option>)}</select></label>
      <label>{t("allCategories")}<select value={draft.category} onChange={(e) => {
        const category = z.enum(themes).parse(e.target.value); const history = historyOf(draft);
        setDraft({ ...draft, category, history: { ...history, editorialStatus: "draft", themes: [...new Set([...history.themes, category])] } });
      }}>{themes.map((value) => <option key={value} value={value}>{h(value)}</option>)}</select></label>
    </div>
    <HistoryFields draft={draft} setDraft={setDraft} locale={language} />
    {draft.sources.map((source, index) => <div className="filters" key={index}>
      <label>{t("sourceTitle")}<input required value={source.title} onChange={(e) => setSources(draft.sources.map((value, i) => i === index ? { ...value, title: e.target.value } : value))} /></label>
      <label>{t("sourceUrl")}<input type="url" required value={source.url} onChange={(e) => setSources(draft.sources.map((value, i) => i === index ? { ...value, url: e.target.value } : value))} /></label>
      {(["author", "publication", "claim"] as const).map((field) => <label key={field}>{h(field === "author" ? "sourceAuthor" : field)}<input maxLength={field === "claim" ? 500 : field === "publication" ? 300 : 200} value={source[field] ?? ""} onChange={(e) => setSources(draft.sources.map((value, i) => i === index ? { ...value, [field]: e.target.value } : value))} /></label>)}
      <button type="button" onClick={() => setSources(draft.sources.filter((_, i) => i !== index))}>{t("remove")}</button>
    </div>)}
    <div className="actions"><button type="button" onClick={() => setSources([...draft.sources, { title: "", url: "" }])}>+ {t("sources")}</button><button className="primary" disabled={busy}>{t("save")}</button></div>
    <ErrorNotice error={error} />
  </form>;
}
function Publishing() {
  const { t, locale } = useLocale();
  const h = useHistoryLabels();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Content>>(`/admin/content?q=${encodeURIComponent(q)}&page=${page}`);
  const [editing, setEditing] = useState<Content | null | undefined>();
  if (editing !== undefined) return <Editor item={editing} onDone={() => { setEditing(undefined); resource.reload(); }} />;
  return <>
    <div className="filters"><label>{t("search")}<input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label><button onClick={() => setEditing(null)}>+ {t("newContent")}</button></div>
    <Status {...resource}>{resource.data?.items.map((item) => <article className="admin-row" key={item.id}><div><strong>{translated(item, locale).text.title}</strong><p>{h(item.kind)} · {t(item.published ? "published" : "draft")}</p><code>{item.id}</code></div><button onClick={() => setEditing(item)}>{t("edit")}</button></article>)}
      {resource.data?.total === 0 && <p>{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={setPage} />}
    </Status>
  </>;
}
export function AdminPage() {
  const { t } = useLocale();
  const membership = useMembership();
  const [tab, setTab] = useState<"members" | "moderation" | "publishing">("members");
  return <section className="section"><p className="eyebrow">{t("admin")}</p><h1>{t("admin")}</h1>
    <Status loading={membership.loading} error={membership.error}>
      {membership.member?.role === "admin" && membership.member.status === "approved" ? <>
        <div className="tabs">{(["members", "moderation", "publishing"] as const).map((value) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(value)}</button>)}</div>
        {tab === "members" ? <Members /> : tab === "moderation" ? <Moderation /> : <Publishing />}
      </> : <p className="notice">{t("memberNotice")}</p>}
    </Status>
  </section>;
}
