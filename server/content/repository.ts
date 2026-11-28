import type { PoolClient } from "pg";
import { historyOf, locales, type ContentInput } from "../../shared/contracts.js";
import { HttpError } from "../security.js";

export async function writeContent(
  client: PoolClient, id: string, item: ContentInput,
  options: { actor?: string; createdAt?: string; update?: boolean; legacy?: boolean; expectedRevision?: number; deferLinks?: boolean } = {},
) {
  const history = historyOf(item);
  const ids = history.relatedIds;
  if (ids.includes(id)) throw new HttpError(400, "SELF_LINK");
  if (ids.length && !options.deferLinks) {
    const targets = await client.query("SELECT id FROM content WHERE id=ANY($1::text[])", [ids]);
    if (targets.rows.length !== ids.length) throw new HttpError(400, "RELATED_CONTENT_MISSING");
  }
  const dates = history.dates;
  const values = [
    id, item.kind, item.published, history.chapter, item.region, item.category,
    dates?.start ?? null, dates?.end ?? null, dates?.precision ?? null, item.dateLabel,
    history.editorialStatus, options.actor ?? null, options.legacy ?? false,
  ];
  if (options.update) {
    const result = await client.query(`UPDATE content SET
      kind=$2,published=$3,chapter_id=$4,primary_region_id=$5,primary_theme_id=$6,
      start_year=$7,end_year=$8,date_precision=$9,original_date_note=$10,
      editorial_status=$11,reviewed_by=CASE WHEN $11='reviewed' THEN $12 ELSE NULL END,
      reviewed_at=CASE WHEN $11='reviewed' THEN now() ELSE NULL END,legacy_review=($13 AND $11='reviewed'),
      revision=revision+1,updated_at=now() WHERE id=$1 AND ($14::integer IS NULL OR revision=$14) RETURNING id`,
    [...values, options.expectedRevision ?? null]);
    if (!result.rowCount) {
      const exists = await client.query("SELECT id FROM content WHERE id=$1", [id]);
      throw new HttpError(exists.rowCount ? 409 : 404, exists.rowCount ? "EDIT_CONFLICT" : "NOT_FOUND");
    }
    for (const table of ["content_translation", "content_region", "content_theme", "citation", "content_link"]) {
      await client.query(`DELETE FROM ${table} WHERE content_id=$1`, [id]);
    }
  } else {
    await client.query(`INSERT INTO content (
      id,kind,published,chapter_id,primary_region_id,primary_theme_id,start_year,end_year,
      date_precision,original_date_note,editorial_status,reviewed_by,legacy_review,reviewed_at,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        CASE WHEN $11='reviewed' THEN $12 ELSE NULL END,($13 AND $11='reviewed'),
        CASE WHEN $11='reviewed' AND NOT $13 THEN now() ELSE NULL END,COALESCE($14::timestamptz,now()))`,
    [...values, options.createdAt ?? null]);
  }
  for (const locale of locales) {
    const text = item.translations[locale];
    if (!text) continue;
    const status = history.translationReview[locale] ?? "draft";
    await client.query(`INSERT INTO content_translation (
      content_id,locale,title,summary,body,date_note,review_status,reviewed_by,reviewed_at,legacy_review)
      VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $7='reviewed' THEN $8 ELSE NULL END,
        CASE WHEN $7='reviewed' AND NOT $9 THEN now() ELSE NULL END,($9 AND $7='reviewed'))`,
    [id, locale, text.title, text.summary, text.body, text.dateLabel ?? null, status, options.actor ?? null, options.legacy ?? false]);
  }
  for (const region of history.regions) await client.query("INSERT INTO content_region VALUES ($1,$2)", [id, region]);
  for (const theme of history.themes) await client.query("INSERT INTO content_theme VALUES ($1,$2)", [id, theme]);
  for (const [index, source] of item.sources.entries()) {
    const result = await client.query<{ id: string }>(`INSERT INTO source (title,url,author,publication) VALUES ($1,$2,$3,$4)
      ON CONFLICT (identity) DO UPDATE SET title=EXCLUDED.title
        WHERE source.url=EXCLUDED.url AND source.title=EXCLUDED.title
          AND source.author=EXCLUDED.author AND source.publication=EXCLUDED.publication RETURNING id`,
    [source.title, source.url, source.author ?? "", source.publication ?? ""]);
    if (!result.rows[0]) throw new Error("Source identity collision; refusing to merge distinct references");
    await client.query("INSERT INTO citation (content_id,source_id,position,claim) VALUES ($1,$2,$3,$4)",
      [id, result.rows[0].id, index + 1, source.claim ?? ""]);
  }
  if (!options.deferLinks) await writeLinks(client, id, item);
}

export async function writeLinks(client: PoolClient, id: string, item: ContentInput) {
  for (const [index, target] of historyOf(item).relatedIds.entries()) {
    await client.query("INSERT INTO content_link (content_id,target_id,link_type,position) VALUES ($1,$2,$3,$4)",
      [id, target, item.kind === "collection" ? "collection_item" : "related", index + 1]);
  }
}
