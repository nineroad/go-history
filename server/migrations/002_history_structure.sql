ALTER TABLE content DROP CONSTRAINT content_kind_check;
ALTER TABLE content ADD CONSTRAINT content_kind_check
  CHECK (kind IN ('event','article','news','person','institution','collection'));
ALTER TABLE content ADD COLUMN history jsonb;
UPDATE content SET history = jsonb_build_object(
  'chapter', CASE id
    WHEN 'origins-in-china' THEN 'origins'
    WHEN 'japan-schools' THEN 'schools'
    WHEN 'international-federation' THEN 'modern'
    ELSE 'unassigned' END,
  'dates', CASE WHEN year IS NULL THEN 'null'::jsonb ELSE jsonb_build_object(
    'start',year,'end',CASE WHEN id='japan-schools' THEN 1867 ELSE NULL END,
    'precision',CASE id WHEN 'origins-in-china' THEN 'approximate'
      WHEN 'japan-schools' THEN 'range' WHEN 'international-federation' THEN 'exact'
      ELSE 'unspecified' END) END,
  'regions',CASE WHEN id='international-federation' THEN jsonb_build_array(region,'Japan') ELSE jsonb_build_array(region) END,
  'themes',CASE WHEN id='japan-schools' THEN jsonb_build_array(category,'Professional') ELSE jsonb_build_array(category) END,
  'relatedIds','[]'::jsonb,'editorialStatus','draft','translationReview','{}'::jsonb
);
CREATE INDEX ON content (kind,published,year,id);
CREATE INDEX content_history_index ON content USING gin (history);
