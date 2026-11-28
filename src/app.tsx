import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useEffect } from "react";
import { locales, localeSchema } from "../shared/contracts";
import { LocaleProvider, useLocale, languageNames } from "./i18n/context";
import { MembershipProvider, useMembership } from "./features/membership/context";
import { HistoryPage, HistoryDirectory, FeedPage, AboutPage } from "./features/history/pages";
import { DetailPage } from "./features/history/detail";
import { CommentPage } from "./features/comments/comments";
import { AccountPage } from "./features/membership/page";
import { AdminPage } from "./features/admin/page";

function Shell() {
  const { locale, t } = useLocale();
  const { member } = useMembership();
  const { locale: param } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  if (!localeSchema.safeParse(param).success) return <Navigate replace to="/en" />;
  return <>
    <a className="skip-link" href="#main">{t("skip")}</a>
    <header className="site-header"><Link className="brand" to={`/${locale}`}><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>{t("brand")}<small>{t("tagline")}</small></span></Link>
      <nav aria-label={t("brand")}>
        <NavLink end to={`/${locale}`}>{t("history")}</NavLink>
        <NavLink to={`/${locale}/articles`}>{t("articles")}</NavLink>
        <NavLink to={`/${locale}/news`}>{t("news")}</NavLink>
        <NavLink to={`/${locale}/about`}>{t("about")}</NavLink>
        {member?.role === "admin" && member.status === "approved" && <NavLink to={`/${locale}/admin`}>{t("admin")}</NavLink>}
      </nav>
      <div className="header-actions"><label className="locale-select"><span className="sr-only">{t("language")}</span><select value={locale} onChange={(e) => navigate(location.pathname.replace(/^\/[^/]+/, `/${e.target.value}`) + location.search + location.hash)}>{locales.map((value) => <option key={value} value={value}>{languageNames[value]}</option>)}</select></label><NavLink className="member-link" to={`/${locale}/account`}>{member?.name ?? t("signIn")}</NavLink></div>
    </header>
    <main id="main"><Outlet /></main>
    <footer><span>{t("brand")}</span><span>{t("footer")}</span><Link to={`/${locale}/about`}>{t("sources")} ↗</Link></footer>
  </>;
}

export function App() {
  return <BrowserRouter><MembershipProvider><Routes>
    <Route path="/" element={<Navigate replace to="/en" />} />
    <Route path="/:locale" element={<LocaleProvider><Shell /></LocaleProvider>}>
      <Route index element={<HistoryPage />} />
      <Route path="history" element={<HistoryPage overview={false} />} />
      {(["regions", "themes", "profiles", "collections"] as const).map((section) => <Route key={section} path={`history/${section}`} element={<HistoryDirectory key={section} section={section} />} />)}
      <Route path="news" element={<FeedPage />} />
      <Route path="articles" element={<FeedPage kind="article" />} />
      <Route path="content/:id" element={<DetailPage />} />
      <Route path="comments/:id" element={<CommentPage />} />
      <Route path="account" element={<AccountPage />} />
      <Route path="admin" element={<AdminPage />} />
      <Route path="about" element={<AboutPage />} />
      <Route path="*" element={<Navigate replace to=".." />} />
    </Route>
  </Routes></MembershipProvider></BrowserRouter>;
}
