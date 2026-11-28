import { historyOf, type Content } from "../../shared/contracts.js";
import type { History } from "../../shared/history.js";

const source = [{ title: "Encyclopaedia Britannica: Go", url: "https://www.britannica.com/topic/go-game" }];
const originalSeed: Content[] = [
  {
    id: "origins-in-china", kind: "event", published: true, year: -2000,
    dateLabel: "c. 2nd millennium BCE · uncertain", region: "China", category: "Origins",
    createdAt: "2026-01-01T00:00:00Z", sources: source,
    translations: {
      en: { title: "A game with ancient roots", summary: "Go's origins are associated with ancient China, but its precise beginnings remain uncertain.", body: "Accounts of Go's invention blend tradition with history. Britannica considers an origin in the second millennium BCE more likely than the earlier dates sometimes claimed. This timeline uses an approximate sort date, not a known year of invention." },
      "zh-Hans": { title: "源远流长的棋艺", summary: "围棋起源于古代中国，但确切的起源时间仍不确定。", body: "围棋的起源记载融合了传说与历史。《大英百科全书》认为，公元前第二个千年的起源比更早的说法更为可信。此处采用近似排序日期，并非已知的发明年份。" },
      "zh-Hant": { title: "源遠流長的棋藝", summary: "圍棋起源於古代中國，但確切的起源時間仍不確定。", body: "圍棋的起源記載融合了傳說與歷史。《大英百科全書》認為，公元前第二個千年的起源比更早的說法更為可信。此處採用近似排序日期，並非已知的發明年份。" },
      ja: { title: "古代に根ざす盤上の文化", summary: "囲碁の起源は古代中国に結び付けられていますが、正確な時期は不明です。", body: "囲碁の起源には伝承と歴史が混在しています。ブリタニカは、より古い説よりも紀元前2千年紀の起源を有力としています。この年表の日付は並べ替え用の概算であり、発明年を示すものではありません。" },
      ko: { title: "고대에 뿌리를 둔 바둑", summary: "바둑은 고대 중국에서 유래한 것으로 알려져 있지만 정확한 기원은 불확실합니다.", body: "바둑의 기원에는 전설과 역사가 함께 전해집니다. 브리태니커는 더 이른 시기라는 주장보다 기원전 두 번째 천년기의 기원을 더 가능성 있게 봅니다. 이 연표의 날짜는 정렬을 위한 근사치이며 확정된 발명 연도가 아닙니다." },
    },
  },
  {
    id: "japan-schools", kind: "event", published: true, year: 1603,
    dateLabel: "1603–1867 · Tokugawa period", region: "Japan", category: "Institutions",
    createdAt: "2026-01-01T00:00:00Z", sources: source,
    translations: { en: { title: "The era of the Go schools", summary: "Government-supported schools helped establish professional Go in Japan.", body: "During the Tokugawa period, four competitive Go schools received government support. Their institutional role helped establish playing Go as a profession. The date shown is a period, not a single founding date." } },
  },
  {
    id: "international-federation", kind: "event", published: true, year: 1982,
    dateLabel: "1982", region: "World", category: "Institutions",
    createdAt: "2026-01-01T00:00:00Z", sources: source,
    translations: { en: { title: "An international community", summary: "The International Go Federation was established in Tokyo.", body: "Go's international following expanded after the Second World War. In 1982, the International Go Federation was established in Tokyo, reflecting a growing global network of players and organizations." } },
  },
  {
    id: "welcome", kind: "news", published: true, year: null,
    dateLabel: "", region: "World", category: "Community",
    createdAt: "2026-11-27T00:00:00Z", sources: [],
    translations: { en: { title: "Welcome to Go History", summary: "An open notebook for a game that connects cultures.", body: "This is the first local development edition of Go History. Explore sourced historical entries, choose your language, and help shape the community. This announcement is project news, not an imported external news report. Translations and editorial review are ongoing." } },
  },
];

const aiSource = [{
  title: "Google DeepMind: AlphaGo", url: "https://deepmind.google/research/alphago/",
  author: "Google DeepMind", claim: "AlphaGo defeated Lee Sedol 4–1 in Seoul in March 2016.",
}];
const additionalSeed: Content[] = [
  {
    id: "reading-the-origins", kind: "article", published: true, year: null, dateLabel: "",
    region: "China", category: "Origins", sources: source, createdAt: "2026-01-01T00:00:00Z",
    translations: { en: { title: "Reading the origins with care", summary: "Why an ancient game's beginning cannot be reduced to a single year.", body: "Traditional accounts of an invention and documentary evidence answer different questions. Britannica describes Go's Chinese origins with uncertainty, considering the second millennium BCE more likely than earlier dates sometimes claimed.\n\nThe timeline uses an approximate start year for navigation. It is not a claim that Go was invented in that precise year. Follow the source and compare its wording with the date certainty recorded on the event." } },
  },
  {
    id: "schools-and-professions", kind: "article", published: true, year: null, dateLabel: "",
    region: "Japan", category: "Institutions", sources: source, createdAt: "2026-01-01T00:00:00Z",
    translations: { en: { title: "Schools, support, and professional play", summary: "Institutions provide another way to read the history of Go.", body: "Britannica describes four competitive Go schools supported by the government during Japan's Tokugawa period. That support helped establish playing Go as a profession.\n\nThe linked event represents the broader period, 1603–1867, not the foundation date of every school. This distinction keeps an institutional overview separate from a claim about a particular school or person." } },
  },
  {
    id: "igf-profile", kind: "institution", published: true, year: null, dateLabel: "",
    region: "World", category: "Institutions", sources: source, createdAt: "2026-01-01T00:00:00Z",
    translations: { en: { title: "International Go Federation", summary: "An institution in the international history of Go.", body: "The International Go Federation was established in Tokyo in 1982, according to Britannica. Its founding is recorded as a separate timeline event so this profile can connect institutional context to chronological history without duplicating the event." } },
  },
  {
    id: "alphago-lee-sedol", kind: "event", published: true, year: 2016, dateLabel: "March 2016 · Seoul",
    region: "Korea", category: "Technology", sources: aiSource, createdAt: "2026-01-01T00:00:00Z",
    translations: { en: { title: "AlphaGo meets Lee Sedol", summary: "A five-game match in Seoul became a landmark in computer Go.", body: "In March 2016, AlphaGo defeated Lee Sedol 4–1 in Seoul, South Korea. DeepMind's account describes this match as a landmark for its AI system. The source is the system's developer, not an independent assessment of every claim about its historical significance." } },
  },
  {
    id: "lee-sedol-profile", kind: "person", published: true, year: null, dateLabel: "",
    region: "Korea", category: "Professional", sources: aiSource, createdAt: "2026-01-01T00:00:00Z",
    translations: { en: { title: "Lee Sedol", summary: "The Go player who faced AlphaGo in Seoul in 2016.", body: "Lee Sedol played a five-game match against AlphaGo in March 2016. He won one game; AlphaGo won four. This initial profile focuses on that sourced episode, rather than attempting a complete biography. Follow the related event for the match's chronological context." } },
  },
  {
    id: "first-steps", kind: "collection", published: true, year: null, dateLabel: "",
    region: "World", category: "Culture", sources: [], createdAt: "2026-01-01T00:00:00Z",
    translations: { en: { title: "A first journey through Go history", summary: "A short reading path from uncertain origins to contemporary computer Go.", body: "Start with the origins article, continue through professional traditions, and then explore international institutions and the AlphaGo match. This is an editorial reading guide, not a complete account of Go's history." } },
  },
];
const metadata: Record<string, Partial<History>> = {
  "origins-in-china": { chapter: "origins", dates: { start: -2000, end: null, precision: "approximate" } },
  "japan-schools": { chapter: "schools", dates: { start: 1603, end: 1867, precision: "range" }, themes: ["Institutions", "Professional"] },
  "international-federation": { chapter: "modern", dates: { start: 1982, end: null, precision: "exact" }, regions: ["World", "Japan"] },
  "reading-the-origins": { chapter: "origins", relatedIds: ["origins-in-china"] },
  "schools-and-professions": { chapter: "schools", relatedIds: ["japan-schools"], themes: ["Institutions", "Professional"] },
  "igf-profile": { chapter: "modern", relatedIds: ["international-federation"], regions: ["World", "Japan"] },
  "alphago-lee-sedol": { chapter: "contemporary", dates: { start: 2016, end: null, precision: "exact" }, regions: ["Korea", "World"], themes: ["Technology", "Professional"] },
  "lee-sedol-profile": { chapter: "contemporary", relatedIds: ["alphago-lee-sedol"], themes: ["Professional", "Technology"] },
  "first-steps": { relatedIds: ["reading-the-origins", "schools-and-professions", "igf-profile", "alphago-lee-sedol"], regions: ["World", "China", "Japan", "Korea"], themes: ["Culture", "Origins", "Institutions", "Technology"] },
};
export const seed: Content[] = [...originalSeed, ...additionalSeed].map((item) => ({
  ...item, history: { ...historyOf(item), ...metadata[item.id] },
}));
