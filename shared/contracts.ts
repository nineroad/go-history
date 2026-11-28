import { z } from "zod";
import { contentKinds, historicalYear, historySchema, legacyHistory, regions, themes } from "./history.js";

export const locales = ["en", "zh-Hans", "zh-Hant", "ja", "ko"] as const;
export type Locale = typeof locales[number];
export const localeSchema = z.enum(locales);
export const translationSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(20000),
  dateLabel: z.string().trim().max(120).optional(),
});
export type Translation = z.infer<typeof translationSchema>;
export const sourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.url().max(2000).refine((url) => /^https?:\/\//.test(url), "HTTP(S) source required"),
  author: z.string().trim().max(200).optional(),
  publication: z.string().trim().max(300).optional(),
  claim: z.string().trim().max(500).optional(),
});
export type Source = z.infer<typeof sourceSchema>;
export const contentInput = z.object({
  kind: z.enum(contentKinds),
  translations: z.partialRecord(localeSchema, translationSchema),
  published: z.boolean(),
  year: historicalYear.nullable(),
  dateLabel: z.string().max(120),
  region: z.enum(regions),
  category: z.enum(themes),
  sources: z.array(sourceSchema).max(20),
  history: historySchema.optional(),
}).refine((value) => Boolean(value.translations.en), { message: "English original required" })
  .refine((value) => value.kind !== "event" || value.sources.length > 0, { message: "Events require sources" })
  .refine((value) => !["person", "institution"].includes(value.kind) || !value.published || value.sources.length > 0, { message: "Published profiles require sources" })
  .refine((value) => value.kind !== "event" || value.year !== null, { message: "Events require a sort year" })
  .refine((value) => !value.history || (value.history.dates?.start ?? null) === value.year, { message: "Sort year must match the structured start year" })
  .refine((value) => !value.history || value.history.regions.includes(value.region) && value.history.themes.includes(value.category), { message: "Primary region and topic must be included in history associations" })
  .refine((value) => !value.history || Object.keys(value.history.translationReview).every((key) => {
    const locale = localeSchema.safeParse(key);
    return locale.success && Boolean(value.translations[locale.data]);
  }), { message: "Review states require an existing translation" });
export type ContentInput = z.infer<typeof contentInput>;
export type Content = ContentInput & { id: string; createdAt: string; revision?: number };
export type Member = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "member" | "admin";
  status: "pending" | "approved" | "suspended";
};
export type Comment = {
  id: string;
  contentId: string;
  author: string;
  body: string;
  status: "pending" | "approved" | "hidden";
  createdAt: string;
};
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export const historyOf = (content: ContentInput) => content.history ?? legacyHistory(content.region, content.category, content.year);
export const allowsComments = (kind: ContentInput["kind"]) => kind === "article" || kind === "news";

export function translated(content: Content, locale: Locale) {
  return {
    text: content.translations[locale] ?? content.translations.en!,
    fallback: !content.translations[locale],
  };
}

export function filterContent(items: Content[], locale: Locale, query: string, region: string, category: string) {
  const needle = query.trim().toLocaleLowerCase(locale);
  return items.filter((item) => {
    const { text } = translated(item, locale);
    const history = historyOf(item);
    return (!region || history.regions.some((value) => value === region)) && (!category || history.themes.some((value) => value === category))
      && `${text.title} ${text.summary} ${text.body}`.toLocaleLowerCase(locale).includes(needle);
  }).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}
