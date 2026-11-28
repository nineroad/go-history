CREATE VIEW content_read AS
SELECT c.id,c.kind,c.published,c.start_year AS year,c.original_date_note AS date_label,
  c.primary_region_id AS region,c.primary_theme_id AS category,c.created_at,
  c.revision,c.updated_at,
  COALESCE((
    SELECT jsonb_object_agg(t.locale,
      jsonb_build_object('title',t.title,'summary',t.summary,'body',t.body)
        || CASE WHEN t.date_note IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('dateLabel',t.date_note) END)
    FROM content_translation t WHERE t.content_id=c.id
  ),'{}'::jsonb) AS translations,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('title',s.title,'url',s.url)
      || CASE WHEN s.author='' THEN '{}'::jsonb ELSE jsonb_build_object('author',s.author) END
      || CASE WHEN s.publication='' THEN '{}'::jsonb ELSE jsonb_build_object('publication',s.publication) END
      || CASE WHEN ref.claim='' THEN '{}'::jsonb ELSE jsonb_build_object('claim',ref.claim) END ORDER BY ref.position)
    FROM citation ref JOIN source s ON s.id=ref.source_id WHERE ref.content_id=c.id
  ),'[]'::jsonb) AS sources,
  jsonb_build_object(
    'chapter',c.chapter_id,
    'dates',CASE WHEN c.start_year IS NULL THEN 'null'::jsonb ELSE
      jsonb_build_object('start',c.start_year,'end',c.end_year,'precision',c.date_precision) END,
    'regions',COALESCE((SELECT jsonb_agg(r.region_id ORDER BY r.region_id) FROM content_region r WHERE r.content_id=c.id),'[]'::jsonb),
    'themes',COALESCE((SELECT jsonb_agg(t.theme_id ORDER BY t.theme_id) FROM content_theme t WHERE t.content_id=c.id),'[]'::jsonb),
    'relatedIds',COALESCE((SELECT jsonb_agg(l.target_id ORDER BY l.position NULLS LAST,l.target_id) FROM content_link l WHERE l.content_id=c.id),'[]'::jsonb),
    'editorialStatus',c.editorial_status,
    'translationReview',COALESCE((SELECT jsonb_object_agg(t.locale,t.review_status) FROM content_translation t WHERE t.content_id=c.id),'{}'::jsonb)
  ) AS history
FROM content c;
