import type { Dispatch, SetStateAction } from "react";
import { z } from "zod";
import { historyOf, type ContentInput, type Locale } from "../../../shared/contracts";
import { chapters, precisions, regions, reviewStates, themes, type History } from "../../../shared/history";
import { useHistoryLabels } from "../../i18n/history";

export function HistoryFields({ draft, setDraft, locale }: {
  draft: ContentInput; setDraft: Dispatch<SetStateAction<ContentInput>>; locale: Locale;
}) {
  const h = useHistoryLabels();
  const history = historyOf(draft);
  function change(update: Partial<History>) {
    const affectsHistory = ["chapter", "dates", "regions", "themes", "relatedIds"].some((key) => key in update);
    setDraft((current) => ({ ...current, history: {
      ...historyOf(current), ...(affectsHistory ? { editorialStatus: "draft" as const } : {}), ...update,
    } }));
  }
  function toggle(key: "regions", value: typeof regions[number], checked: boolean): void;
  function toggle(key: "themes", value: typeof themes[number], checked: boolean): void;
  function toggle(key: "regions" | "themes", value: typeof themes[number] | typeof regions[number], checked: boolean) {
    if (key === "regions") {
      const region = z.enum(regions).parse(value);
      change({ regions: checked ? [...history.regions, region] : history.regions.filter((item) => item !== region) });
    } else {
      const theme = z.enum(themes).parse(value);
      change({ themes: checked ? [...history.themes, theme] : history.themes.filter((item) => item !== theme) });
    }
  }
  return <fieldset className="history-fields"><legend>{h("associations")}</legend>
    <div className="filters">
      <label>{h("chapters")}<select value={history.chapter} onChange={(e) => change({ chapter: z.enum(chapters).parse(e.target.value) })}>{chapters.map((key) => <option key={key} value={key}>{h(key)}</option>)}</select></label>
      <label>{h("endYear")}<input type="number" disabled={draft.year === null} value={history.dates?.end ?? ""} onChange={(e) => {
        if (history.dates) change({ dates: { ...history.dates, end: e.target.value ? Number(e.target.value) : null } });
      }} /></label>
      <label>{h("precision")}<select disabled={!history.dates} value={history.dates?.precision ?? "unspecified"} onChange={(e) => {
        if (history.dates) change({ dates: { ...history.dates, precision: z.enum(precisions).parse(e.target.value) } });
      }}>{precisions.map((key) => <option key={key} value={key}>{h(key)}</option>)}</select></label>
    </div>
    <fieldset><legend>{h("regions")}</legend><div className="check-options">{regions.map((region) => <label className="check" key={region}><input type="checkbox" checked={history.regions.includes(region)} disabled={draft.region === region} onChange={(e) => toggle("regions", region, e.target.checked)} />{h(region)}</label>)}</div></fieldset>
    <fieldset><legend>{h("themes")}</legend><div className="check-options">{themes.map((theme) => <label className="check" key={theme}><input type="checkbox" checked={history.themes.includes(theme)} disabled={draft.category === theme} onChange={(e) => toggle("themes", theme, e.target.checked)} />{h(theme)}</label>)}</div></fieldset>
    <div className="filters">
      <label>{h("editorialStatus")}<select value={history.editorialStatus} onChange={(e) => change({ editorialStatus: z.enum(reviewStates).parse(e.target.value) })}>{reviewStates.map((key) => <option value={key} key={key}>{h(key)}</option>)}</select></label>
      <label>{h("translationStatus")}<select value={history.translationReview[locale] ?? "draft"} onChange={(e) => change({ translationReview: { ...history.translationReview, [locale]: z.enum(reviewStates).parse(e.target.value) } })}>{reviewStates.map((key) => <option value={key} key={key}>{h(key)}</option>)}</select></label>
    </div>
    <label>{h("relatedIds")}<textarea value={history.relatedIds.join("\n")} onChange={(e) => change({ relatedIds: e.target.value.split("\n").map((id) => id.trim()).filter(Boolean) })} /></label>
  </fieldset>;
}
