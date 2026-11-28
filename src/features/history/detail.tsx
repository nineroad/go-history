import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { allowsComments, historyOf, translated, type Content, type Page } from "../../../shared/contracts";
import { useLocale } from "../../i18n/context";
import { useResource } from "../../lib/use-resource";
import { Share, Status, Pager } from "../../components/common";
import { Discussion } from "../comments/comments";
import { HistoryNav, HistoryDate, ContentCard } from "./components";
import { useHistoryLabels } from "../../i18n/history";

function RelatedContent({ item }: { item: Content }) {
  const h = useHistoryLabels();
  const [page, setPage] = useState(1);
  const resource = useResource<Page<Content>>(`/content/${encodeURIComponent(item.id)}/related?page=${page}`);
  if (!resource.loading && !resource.error && resource.data?.total === 0) return null;
  return <section className="sources"><h2>{h(item.kind === "collection" ? "readingOrder" : "related")}</h2><Status {...resource}>
    <ol className="related-list">{resource.data?.items.map((related) => <li key={related.id}><ContentCard item={related} heading="h3" /></li>)}</ol>
    {resource.data && <Pager {...resource.data} onPage={setPage} />}
  </Status></section>;
}

export function DetailPage() {
  const { id = "" } = useParams();
  const { locale, t } = useLocale();
  const h = useHistoryLabels();
  const resource = useResource<Content>(`/content/${encodeURIComponent(id)}`);
  const result = resource.data ? translated(resource.data, locale) : undefined;
  useEffect(() => {
    document.title = result ? `${result.text.title} · Go History` : "Go History";
    return () => { document.title = "Go History"; };
  }, [result?.text.title]);
  return <section className="section prose"><HistoryNav /><Link className="text-link" to={`/${locale}`}>← {t("back")}</Link>
    <Status {...resource}>{resource.data && result && <>
      <p className="eyebrow">{h(resource.data.kind)} / {h(historyOf(resource.data).chapter)}</p>
      <HistoryDate item={resource.data} />
      <div className="history-associations">
        {historyOf(resource.data).regions.map((region) => <Link key={region} to={`/${locale}/history/regions?region=${region}`}>{h(region)}</Link>)}
        {historyOf(resource.data).themes.map((theme) => <Link key={theme} to={`/${locale}/history/themes?theme=${theme}`}>{h(theme)}</Link>)}
      </div>
      <p className="muted review-status">{h("editorialStatus")}: {h(historyOf(resource.data).editorialStatus)} · {h("translationStatus")}: {h(historyOf(resource.data).translationReview[result.fallback ? "en" : locale] ?? "draft")}</p>
      {result.fallback && <p className="notice">{t("fallback")}</p>}
      <div lang={result.fallback ? "en" : locale}><h1>{result.text.title}</h1><p className="lead">{result.text.summary}</p><p className="body-text">{result.text.body}</p></div>
      {!!resource.data.sources.length && <section className="sources"><h2>{t("sources")}</h2><ul>{resource.data.sources.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
        {(source.author || source.publication) && <p className="muted">{[source.author, source.publication].filter(Boolean).join(" · ")}</p>}
        {source.claim && <p>{h("claim")}: {source.claim}</p>}
      </li>)}</ul></section>}
      <RelatedContent key={resource.data.id} item={resource.data} />
      <Share path={`/${locale}/content/${id}`} />
      {allowsComments(resource.data.kind) && <Discussion key={resource.data.id} contentId={resource.data.id} />}
    </>}</Status>
  </section>;
}
