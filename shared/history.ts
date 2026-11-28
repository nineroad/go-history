import { z } from "zod";

export const contentKinds = ["event", "article", "news", "person", "institution", "collection"] as const;
export const regions = ["China", "Japan", "Korea", "World"] as const;
export const themes = ["Origins", "Culture", "Institutions", "Community", "Professional", "Tournaments", "Rules", "Technology"] as const;
export const chapters = ["origins", "spread", "schools", "modern", "contemporary", "unassigned"] as const;
export const reviewStates = ["draft", "reviewed"] as const;
export const precisions = ["exact", "approximate", "range", "disputed", "unspecified"] as const;
export const historicalYear = z.number().int().min(-10000).max(3000).refine((year) => year !== 0, "There is no historical year zero");
export const datesSchema = z.object({
  start: historicalYear,
  end: historicalYear.nullable(),
  precision: z.enum(precisions),
}).refine((date) => date.end === null || date.end >= date.start, { message: "End year must not precede start year" })
  .refine((date) => date.precision !== "range" || date.end !== null, { message: "Ranges require an end year" })
  .refine((date) => date.precision !== "exact" || date.end === null || date.end === date.start, { message: "Exact years cannot span a range" });
export const historySchema = z.object({
  chapter: z.enum(chapters),
  dates: datesSchema.nullable(),
  regions: z.array(z.enum(regions)).min(1).max(regions.length),
  themes: z.array(z.enum(themes)).min(1).max(themes.length),
  relatedIds: z.array(z.string().min(1).max(100)).max(50),
  editorialStatus: z.enum(reviewStates),
  translationReview: z.record(z.string(), z.enum(reviewStates)),
}).refine((value) => new Set(value.relatedIds).size === value.relatedIds.length, { message: "Related IDs must be unique" })
  .refine((value) => new Set(value.regions).size === value.regions.length && new Set(value.themes).size === value.themes.length, { message: "Region and theme associations must be unique" });
export type History = z.infer<typeof historySchema>;
export type HistoryKey = typeof chapters[number] | typeof themes[number] | typeof regions[number];

export function legacyHistory(region: typeof regions[number], category: typeof themes[number], year: number | null): History {
  return {
    chapter: "unassigned", dates: year === null ? null : { start: year, end: null, precision: "unspecified" },
    regions: [region], themes: [category], relatedIds: [], editorialStatus: "draft", translationReview: {},
  };
}
