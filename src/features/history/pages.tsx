import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { historyOf, translated, type Content, type Page, type Source } from "../../../shared/contracts";
import { chapters, regions, themes, contentKinds } from "../../../shared/history";
import { useLocale } from "../../i18n/context";
import { useHistoryLabels } from "../../i18n/history";
import { useResource } from "../../lib/use-resource";
import { Status, Pager } from "../../components/common";
import { HistoryNav, HistoryDate, ContentCard } from "./components";

function Board() {
  const stones = [[2, 3, "black"], [3, 3, "white"], [4, 4, "black"], [4, 5, "white"], [5, 4, "black"], [6, 6, "white"], [7, 5, "black"], [2, 7, "white"], [3, 7, "black"], [6, 2, "black"]];
  return <div className="board-art" aria-hidden="true"><div className="board-grid">
    {stones.map(([x, y, color], i) => <span key={i} className={`stone ${color}`} style={{ left: `${Number(x) * 10}%`, top: `${Number(y) * 10}%` }} />)}
  </div><span className="board-caption">19 × 19 · ∞</span></div>;
}
export function HistoryPage({ overview = true }: { overview?: boolean }) {
  const { t, locale } = useLocale();
  const h = useHistoryLabels();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const region = params.get("region") ?? "";
  const category = params.get("theme") ?? "";
  const chapter = params.get("chapter") ?? "";
  const search = new URLSearchParams(params);
  search.set("kind", "event"); search.set("locale", locale);
  const resource = useResource<Page<Content>>(`/content?${search}`);
  const items = resource.data?.items ?? [];
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page"); setParams(next, { replace: true });
  }
  return <>
    <HistoryNav />
    {overview && <section className="hero">
      <div><p className="eyebrow">{t("eyebrow")}</p><h1>{t("heroTitle")}</h1><p className="hero-description">{t("heroBody")}</p>
        <div className="actions"><a className="button primary" href="#timeline">{t("explore")} <span aria-hidden="true">↘</span></a><Link className="text-link" to={`/${locale}/account`}>{t("join")} <span aria-hidden="true">→</span></Link></div>
      </div><Board />
    </section>}
    <section id="timeline" className="section">
      <div className="section-heading"><div><p className="eyebrow">01 / {t("history")}</p>{overview ? <h2>{t("timeline")}</h2> : <h1>{t("timeline")}</h1>}<p className="muted">{t("timelineBody")}</p></div></div>
      <p className="muted">{h("chapterNote")}</p>
      <div className="chapter-links">{chapters.filter((key) => key !== "unassigned").map((key) => <button key={key} aria-pressed={chapter === key} onClick={() => filter("chapter", chapter === key ? "" : key)}>{h(key)}</button>)}</div>
      <div className="filters">
        <label className="search-field"><span>{t("search")}</span><input value={query} onChange={(e) => filter("q", e.target.value)} placeholder={t("searchHint")} /></label>
        <label><span>{t("allRegions")}</span><select value={region} onChange={(e) => filter("region", e.target.value)}><option value="">{t("allRegions")}</option>{regions.map((value) => <option key={value} value={value}>{h(value)}</option>)}</select></label>
        <label><span>{t("allCategories")}</span><select value={category} onChange={(e) => filter("theme", e.target.value)}><option value="">{t("allCategories")}</option>{themes.map((value) => <option key={value} value={value}>{h(value)}</option>)}</select></label>
        <label><span>{h("chapters")}</span><select value={chapter} onChange={(e) => filter("chapter", e.target.value)}><option value="">{h("allChapters")}</option>{chapters.map((value) => <option key={value} value={value}>{h(value)}</option>)}</select></label>
      </div>
      <Status {...resource}>
        {chapters.filter((key) => !chapter || key === chapter).map((key) => {
          const entries = items.filter((item) => historyOf(item).chapter === key);
          if (!entries.length && resource.data && resource.data.total > resource.data.pageSize) return null;
          if (!entries.length && (query || region || category || key === "unassigned")) return null;
          return <section className="chapter-section" key={key}>{overview ? <h3>{h(key)}</h3> : <h2>{h(key)}</h2>}
            {!entries.length && <p className="muted">{h("emptyChapter")}</p>}
            <div className="timeline">{entries.map((item) => <div className="timeline-item" key={item.id}>
              <div className="timeline-date"><span className="timeline-dot" /><HistoryDate item={item} /></div><ContentCard item={item} heading={overview ? "h4" : "h3"} />
            </div>)}</div>
          </section>;
        })}
        {!items.length && (query || region || category) && <p>{t("empty")}</p>}
        {resource.data && <Pager {...resource.data} onPage={(page) => {
          const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next);
        }} />}
      </Status>
    </section>
  </>;
}
export function FeedPage({ kind = "news" }: { kind?: "news" | "article" }) {
  const { t, locale } = useLocale();
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Content>>(`/content?kind=${kind}&locale=${locale}&page=${page}`);
  return <section className="section">
    {kind === "article" && <HistoryNav />}
    <p className="eyebrow">{t(kind === "news" ? "news" : "articles")}</p><h1>{t(kind === "news" ? "newsTitle" : "articles")}</h1>{kind === "news" && <p className="muted">{t("newsBody")}</p>}
    <Status {...resource}><div className="card-grid">{resource.data?.items.map((item) => {
      const { text, fallback } = translated(item, locale);
      return <article className="story-card" key={item.id}><p className="eyebrow">{new Date(item.createdAt).toLocaleDateString(locale)}</p><h2 lang={fallback ? "en" : locale}>{text.title}</h2><p lang={fallback ? "en" : locale}>{text.summary}</p>{fallback && <small>{t("fallback")}</small>}<Link className="text-link" to={`/${locale}/content/${item.id}`}>{t("read")} →</Link></article>;
    })}</div>
      {resource.data?.total === 0 && <p>{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={setPage} />}
    </Status>
  </section>;
}
export function AboutPage() {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Source>>(`/content/sources?page=${page}`);
  return <section className="section prose"><HistoryNav /><p className="eyebrow">{t("about")}</p><h1>{t("aboutTitle")}</h1><p>{t("aboutBody")}</p><h2>{t("sources")}</h2>
    <Status {...resource}><ul>{resource.data?.items.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
      {(source.author || source.publication) && <p className="muted">{[source.author, source.publication].filter(Boolean).join(" · ")}</p>}
    </li>)}</ul>
      {resource.data?.total === 0 && <p>{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={setPage} />}
    </Status>
  </section>;
}

export function HistoryDirectory({ section }: { section: "regions" | "themes" | "profiles" | "collections" }) {
  const { locale, t } = useLocale();
  const h = useHistoryLabels();
  const [params, setParams] = useSearchParams();
  const search = new URLSearchParams(params);
  search.set("locale", locale);
  search.set("kind", section === "collections" ? "collection" : section === "profiles" ? (params.get("kind") ?? "person") : params.get("kind") ?? "history");
  const resource = useResource<Page<Content>>(`/content?${search}`);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page"); setParams(next);
  }
  return <section className="section"><HistoryNav /><p className="eyebrow">{t("history")}</p><h1>{h(section)}</h1>
    {(section === "regions" || section === "themes") && <div className="chapter-links">
      {(section === "regions" ? regions : themes).map((value) => {
        const key = section === "regions" ? "region" : "theme";
        return <button key={value} aria-pressed={params.get(key) === value} onClick={() => change(key, params.get(key) === value ? "" : value)}>{h(value)}</button>;
      })}
    </div>}
    <div className="filters"><label className="search-field">{t("search")}<input value={params.get("q") ?? ""} onChange={(e) => change("q", e.target.value)} /></label>
      {section !== "collections" && <label>{t("kind")}<select value={search.get("kind")!} onChange={(e) => change("kind", e.target.value)}>
        {section !== "profiles" && <option value="history">{h("allTypes")}</option>}
        {(section === "profiles" ? (["person", "institution"] as const) : contentKinds.filter((kind) => kind !== "news")).map((kind) => <option value={kind} key={kind}>{h(kind)}</option>)}
      </select></label>}
    </div>
    <Status {...resource}><div className="card-grid">{resource.data?.items.map((item) => <ContentCard key={item.id} item={item} />)}</div>
      {resource.data?.total === 0 && <p>{t("empty")}</p>}
      {resource.data && <Pager {...resource.data} onPage={(page) => { const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next); }} />}
    </Status>
  </section>;
}
