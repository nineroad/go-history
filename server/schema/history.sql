-- Canonical normalized history DDL. The migration substitutes history_design
-- with the current application schema, after retaining legacy content.
CREATE SCHEMA history_design;

CREATE TABLE history_design.locale (
  code text PRIMARY KEY CHECK (code IN ('en','zh-Hans','zh-Hant','ja','ko'))
);
INSERT INTO history_design.locale VALUES ('en'),('zh-Hans'),('zh-Hant'),('ja'),('ko');

CREATE TABLE history_design.chapter (
  id text PRIMARY KEY,
  position integer NOT NULL UNIQUE CHECK (position >= 0)
);
INSERT INTO history_design.chapter VALUES
  ('origins',0),('spread',1),('schools',2),('modern',3),('contemporary',4),('unassigned',5);
CREATE TABLE history_design.region (id text PRIMARY KEY);
INSERT INTO history_design.region VALUES ('China'),('Japan'),('Korea'),('World');
CREATE TABLE history_design.theme (id text PRIMARY KEY);
INSERT INTO history_design.theme VALUES
  ('Origins'),('Culture'),('Institutions'),('Community'),
  ('Professional'),('Tournaments'),('Rules'),('Technology');

CREATE TABLE history_design.chapter_translation (
  chapter_id text NOT NULL REFERENCES history_design.chapter ON DELETE CASCADE,
  locale text NOT NULL REFERENCES history_design.locale,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  description text NOT NULL DEFAULT '',
  PRIMARY KEY (chapter_id,locale)
);
CREATE TABLE history_design.region_translation (
  region_id text NOT NULL REFERENCES history_design.region ON DELETE CASCADE,
  locale text NOT NULL REFERENCES history_design.locale,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  PRIMARY KEY (region_id,locale)
);
CREATE TABLE history_design.theme_translation (
  theme_id text NOT NULL REFERENCES history_design.theme ON DELETE CASCADE,
  locale text NOT NULL REFERENCES history_design.locale,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  PRIMARY KEY (theme_id,locale)
);

CREATE TABLE history_design.content (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK (kind IN ('event','article','news','person','institution','collection')),
  published boolean NOT NULL DEFAULT false,
  chapter_id text NOT NULL DEFAULT 'unassigned' REFERENCES history_design.chapter,
  original_locale text NOT NULL DEFAULT 'en' CHECK (original_locale='en'),
  primary_region_id text NOT NULL REFERENCES history_design.region,
  primary_theme_id text NOT NULL REFERENCES history_design.theme,
  start_year integer CHECK (start_year BETWEEN -10000 AND 3000 AND start_year<>0),
  end_year integer CHECK (end_year BETWEEN -10000 AND 3000 AND end_year<>0),
  date_precision text CHECK (date_precision IN ('exact','approximate','range','disputed','unspecified')),
  original_date_note text NOT NULL DEFAULT '' CHECK (length(original_date_note)<=120),
  editorial_status text NOT NULL DEFAULT 'draft' CHECK (editorial_status IN ('draft','reviewed')),
  reviewed_by text REFERENCES public."user"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  legacy_review boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((start_year IS NULL AND end_year IS NULL AND date_precision IS NULL)
    OR (start_year IS NOT NULL AND date_precision IS NOT NULL
      AND (end_year IS NULL OR end_year>=start_year)
      AND (date_precision<>'range' OR end_year IS NOT NULL)
      AND (date_precision<>'exact' OR end_year IS NULL OR end_year=start_year))),
  CHECK (kind<>'event' OR start_year IS NOT NULL),
  CHECK (editorial_status<>'reviewed' OR reviewed_at IS NOT NULL OR legacy_review)
);

CREATE TABLE history_design.content_translation (
  content_id text NOT NULL REFERENCES history_design.content ON DELETE CASCADE,
  locale text NOT NULL REFERENCES history_design.locale,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 500),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 20000),
  date_note text CHECK (length(date_note)<=120),
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','reviewed')),
  reviewed_by text REFERENCES public."user"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  legacy_review boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id,locale),
  CHECK (review_status<>'reviewed' OR reviewed_at IS NOT NULL OR legacy_review)
);
ALTER TABLE history_design.content ADD CONSTRAINT content_original_translation_fk
  FOREIGN KEY (id,original_locale)
  REFERENCES history_design.content_translation(content_id,locale)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE history_design.content_region (
  content_id text NOT NULL REFERENCES history_design.content ON DELETE CASCADE,
  region_id text NOT NULL REFERENCES history_design.region,
  PRIMARY KEY (content_id,region_id)
);
CREATE TABLE history_design.content_theme (
  content_id text NOT NULL REFERENCES history_design.content ON DELETE CASCADE,
  theme_id text NOT NULL REFERENCES history_design.theme,
  PRIMARY KEY (content_id,theme_id)
);
ALTER TABLE history_design.content ADD CONSTRAINT content_primary_region_fk
  FOREIGN KEY (id,primary_region_id) REFERENCES history_design.content_region(content_id,region_id)
  DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE history_design.content ADD CONSTRAINT content_primary_theme_fk
  FOREIGN KEY (id,primary_theme_id) REFERENCES history_design.content_theme(content_id,theme_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION history_design.source_identity(url text,title text,author text,publication text)
RETURNS bytea LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT sha256(convert_to(
    length(url)::text || ':' || url || length(title)::text || ':' || title ||
    length(author)::text || ':' || author || length(publication)::text || ':' || publication,
    'UTF8'));
$$;
CREATE TABLE history_design.source (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  url text NOT NULL CHECK (url ~ '^https?://[^[:space:]]+$' AND length(url)<=2000),
  author text NOT NULL DEFAULT '' CHECK (length(author)<=200),
  publication text NOT NULL DEFAULT '' CHECK (length(publication)<=300),
  identity bytea GENERATED ALWAYS AS (history_design.source_identity(url,title,author,publication)) STORED UNIQUE
);
CREATE TABLE history_design.citation (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id text NOT NULL REFERENCES history_design.content ON DELETE CASCADE,
  source_id bigint NOT NULL REFERENCES history_design.source,
  position integer NOT NULL CHECK (position>0),
  claim text NOT NULL DEFAULT '' CHECK (length(claim)<=500),
  claim_locale text NOT NULL DEFAULT 'en' REFERENCES history_design.locale,
  UNIQUE (content_id,position)
);

CREATE TABLE history_design.content_link (
  content_id text NOT NULL REFERENCES history_design.content ON DELETE CASCADE,
  target_id text NOT NULL REFERENCES history_design.content ON DELETE RESTRICT,
  link_type text NOT NULL CHECK (link_type IN ('related','collection_item')),
  position integer,
  PRIMARY KEY (content_id,target_id),
  CHECK (content_id<>target_id),
  CHECK ((link_type='related' AND (position IS NULL OR position>0))
    OR (link_type='collection_item' AND position IS NOT NULL AND position>0))
);
CREATE UNIQUE INDEX collection_item_order ON history_design.content_link(content_id,position)
  WHERE link_type='collection_item';
CREATE INDEX content_link_reverse ON history_design.content_link(target_id,content_id);
CREATE INDEX content_timeline ON history_design.content(start_year,id) WHERE published AND kind='event';
CREATE INDEX content_feed ON history_design.content(kind,created_at DESC,id) WHERE published;
CREATE INDEX content_chapter ON history_design.content(chapter_id,kind,start_year,id) WHERE published;
CREATE INDEX region_content ON history_design.content_region(region_id,content_id);
CREATE INDEX theme_content ON history_design.content_theme(theme_id,content_id);
CREATE INDEX citation_source ON history_design.citation(source_id,content_id);
CREATE INDEX translation_locale ON history_design.content_translation(locale,content_id);

CREATE FUNCTION history_design.immutable_content_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.id<>NEW.id THEN
    RAISE EXCEPTION 'Content IDs are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER content_id_immutable BEFORE UPDATE OF id ON history_design.content
  FOR EACH ROW EXECUTE FUNCTION history_design.immutable_content_id();

-- Cross-row rules are checked at transaction commit so a complete record can
-- be inserted/edited in one transaction, in any order.
CREATE FUNCTION history_design.check_content_integrity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  owner_id text;
  record_kind text;
  is_published boolean;
BEGIN
  IF TG_TABLE_NAME='content' THEN
    owner_id := CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    owner_id := CASE WHEN TG_OP='DELETE' THEN OLD.content_id ELSE NEW.content_id END;
    IF TG_OP='UPDATE' AND OLD.content_id<>NEW.content_id THEN
      RAISE EXCEPTION 'Association ownership is immutable; delete and insert instead'
        USING ERRCODE='23514';
    END IF;
  END IF;
  -- Serializes citation/link integrity checks with concurrent parent changes.
  SELECT kind,published INTO record_kind,is_published
    FROM history_design.content WHERE id=owner_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF (record_kind='event' OR (record_kind IN ('person','institution') AND is_published))
    AND NOT EXISTS (SELECT 1 FROM history_design.citation WHERE content_id=owner_id) THEN
    RAISE EXCEPTION 'Events and published profiles require a citation' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM history_design.content_link
    WHERE content_id=owner_id AND
      ((record_kind='collection' AND link_type<>'collection_item')
        OR (record_kind<>'collection' AND link_type<>'related'))
  ) THEN
    RAISE EXCEPTION 'Collection items belong only to collections; other entries use related links'
      USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER content_integrity
  AFTER INSERT OR UPDATE ON history_design.content
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION history_design.check_content_integrity();
CREATE CONSTRAINT TRIGGER citation_integrity
  AFTER INSERT OR UPDATE OR DELETE ON history_design.citation
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION history_design.check_content_integrity();
CREATE CONSTRAINT TRIGGER link_integrity
  AFTER INSERT OR UPDATE OR DELETE ON history_design.content_link
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION history_design.check_content_integrity();
