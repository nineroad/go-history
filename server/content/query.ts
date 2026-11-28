import { z } from "zod";
import { localeSchema } from "../../shared/contracts.js";
import { chapters, contentKinds, regions, themes } from "../../shared/history.js";
import { pagination } from "../security.js";

export const contentQuery = pagination.extend({
  kind: z.enum([...contentKinds, "history"]).default("event"),
  locale: localeSchema.default("en"),
  region: z.enum([...regions, ""]).default(""),
  theme: z.enum([...themes, ""]).default(""),
  chapter: z.enum([...chapters, ""]).default(""),
});
export function publicFilter(query: z.infer<typeof contentQuery>) {
  const { kind, locale, q, region, theme, chapter } = query;
  const where = `published=true AND (($1='history' AND kind<>'news') OR kind=$1)
    AND strpos(lower(COALESCE(translations->$2,translations->'en')::text),lower($3))>0
    AND ($4='' OR COALESCE(history->'regions',jsonb_build_array(region)) ? $4)
    AND ($5='' OR COALESCE(history->'themes',jsonb_build_array(category)) ? $5)
    AND ($6='' OR COALESCE(history->>'chapter','unassigned')=$6)`;
  return { where, values: [kind, locale, q.trim(), region, theme, chapter] };
}
