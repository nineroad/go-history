import { NavLink, Link } from "react-router-dom";
import { historyOf, translated, type Content } from "../../../shared/contracts";
import { useLocale } from "../../i18n/context";
import { useHistoryLabels } from "../../i18n/history";

export function HistoryNav() {
  const { locale, t } = useLocale();
  const h = useHistoryLabels();
  return <nav className="history-nav" aria-label={t("history")}>
    <NavLink end to={`/${locale}`}>{h("overview")}</NavLink>
    <NavLink end to={`/${locale}/history`}>{h("chronology")}</NavLink>
    {(["regions", "profiles", "themes", "collections"] as const).map((key) => <NavLink key={key} to={`/${locale}/history/${key}`}>{h(key)}</NavLink>)}
    <NavLink to={`/${locale}/about`}>{t("sources")}</NavLink>
  </nav>;
}
export function HistoryDate({ item }: { item: Content }) {
  const { locale } = useLocale();
  const h = useHistoryLabels();
  const date = historyOf(item).dates;
  const label = item.translations[locale]?.dateLabel || item.dateLabel;
  const dateLocale = item.translations[locale]?.dateLabel ? locale : "en";
  if (!date && !label) return null;
  const format = (year: number) => {
    const value = new Date(0);
    value.setUTCFullYear(year < 0 ? year + 1 : year, 0, 1);
    return new Intl.DateTimeFormat(locale, { year: "numeric", era: "short", timeZone: "UTC" }).format(value);
  };
  return <div className="history-date">
    {date && <strong>{format(date.start)}{date.end !== null && date.end !== date.start ? ` – ${format(date.end)}` : ""} <small>· {h(date.precision)}</small></strong>}
    {label && <span lang={dateLocale}>{label}</span>}
    {label && locale !== "en" && dateLocale === "en" && <small>{h("dateFallback")}</small>}
  </div>;
}
export function ContentCard({ item, heading = "h2" }: { item: Content; heading?: "h2" | "h3" | "h4" }) {
  const { t, locale } = useLocale();
  const h = useHistoryLabels();
  const { text, fallback } = translated(item, locale);
  const Heading = heading;
  return <article className="story-card">
    <p className="eyebrow">{h(item.kind)} / {historyOf(item).regions.map(h).join(" · ")}</p>
    <Heading lang={fallback ? "en" : locale}>{text.title}</Heading>
    <p lang={fallback ? "en" : locale}>{text.summary}</p>
    {fallback && <small className="muted">{t("fallback")}</small>}
    <Link className="text-link" to={`/${locale}/content/${item.id}`}>{t("read")} →</Link>
  </article>;
}
