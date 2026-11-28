import { test } from "node:test";
import assert from "node:assert/strict";
import { contentInput, filterContent, translated, locales, historyOf, allowsComments } from "../shared/contracts.js";
import { datesSchema } from "../shared/history.js";
import { historyLabel } from "../src/i18n/history.js";
import { seed } from "../server/content/seed.js";
import { dictionaries, english } from "../src/i18n/messages.js";

test("seed content validates and every event has a source", () => {
  for (const item of seed) assert.ok(contentInput.safeParse(item).success, item.id);
  assert.equal(contentInput.safeParse({ ...seed[0], sources: [] }).success, false);
  assert.equal(contentInput.safeParse({ ...seed[0], translations: {} }).success, false);
});
test("sorting handles BCE and range-start sort years", () => {
  assert.deepEqual(filterContent([...seed.filter((item) => item.kind === "event")].reverse(), "en", "", "", "").map((item) => item.year), [-2000, 1603, 1982, 2016]);
});
test("structured dates reject reversed ranges, year zero and inconsistent sort years", () => {
  assert.equal(datesSchema.safeParse({ start: -100, end: 100, precision: "range" }).success, true);
  assert.equal(datesSchema.safeParse({ start: 0, end: null, precision: "exact" }).success, false);
  assert.equal(datesSchema.safeParse({ start: 1900, end: 1800, precision: "range" }).success, false);
  assert.equal(datesSchema.safeParse({ start: 1900, end: null, precision: "range" }).success, false);
  assert.equal(datesSchema.safeParse({ start: 1900, end: 1901, precision: "exact" }).success, false);
  assert.equal(contentInput.safeParse({ ...seed[0], year: -1000 }).success, false);
});
test("history supports shared associations without duplicate records", () => {
  const events = seed.filter((item) => item.kind === "event");
  assert.deepEqual(filterContent(events, "en", "", "Japan", "Institutions").map((item) => item.id), ["japan-schools", "international-federation"]);
  assert.equal(filterContent(events, "en", "", "Korea", "Technology").length, 1);
  assert.equal(historyOf(seed[0]).chapter, "origins");
  for (const item of seed) for (const id of historyOf(item).relatedIds) assert.ok(seed.some((target) => target.id === id));
});
test("legacy metadata stays readable and review requires an existing locale", () => {
  const { history, ...legacy } = seed[0];
  assert.equal(historyOf(legacy).chapter, "unassigned");
  assert.deepEqual(historyOf(legacy).regions, ["China"]);
  assert.equal(contentInput.safeParse({ ...seed[0], history: { ...history, translationReview: { invalid: "reviewed" } } }).success, false);
  assert.equal(contentInput.safeParse({ ...seed[1], history: { ...seed[1].history, translationReview: { ko: "reviewed" } } }).success, false);
  for (const kind of ["person", "institution", "collection", "event"] as const) assert.equal(allowsComments(kind), false);
  assert.equal(allowsComments("article"), true);
  for (const locale of locales) assert.ok(historyLabel("contemporary", locale));
});
test("search supports CJK substrings and combined filters", () => {
  assert.equal(filterContent(seed, "zh-Hans", "围棋", "China", "Origins").length, 1);
  assert.equal(filterContent(seed, "ja", "囲碁", "China", "Origins").length, 1);
  assert.equal(filterContent(seed, "ko", "바둑", "China", "Origins").length, 1);
  assert.equal(filterContent(seed, "en", "ANCIENT", "Japan", "").length, 0);
});
test("translation fallback is explicit and all five UI dictionaries are complete", () => {
  assert.equal(translated(seed[1], "ko").fallback, true);
  assert.equal(translated(seed[0], "ko").fallback, false);
  for (const locale of locales) assert.deepEqual(Object.keys(dictionaries[locale]).sort(), Object.keys(english).sort());
});
