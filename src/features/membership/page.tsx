import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { createAuthClient } from "better-auth/react";
import { useLocale } from "../../i18n/context";
import { useMembership } from "./context";
import { ErrorNotice, Status } from "../../components/common";

const authClient = createAuthClient();
export function AccountPage() {
  const { t, locale } = useLocale();
  const membership = useMembership();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(token ? "reset" : "login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<Error>();
  async function updateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(undefined); setMessage("");
    const name = String(new FormData(e.currentTarget).get("name"));
    try {
      const result = await authClient.updateUser({ name });
      if (result.error) throw new Error(result.error.message);
      membership.reload(); setMessage(t("saved"));
    } catch (failure) { setError(failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(undefined); setMessage("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    try {
      let result;
      if (mode === "register") result = await authClient.signUp.email({ name: String(data.get("name")), email, password, callbackURL: `/${locale}/account` });
      else if (mode === "forgot") result = await authClient.requestPasswordReset({ email, redirectTo: `/${locale}/account` });
      else if (mode === "reset") result = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
      else result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message ?? result.error.code);
      if (mode === "login") membership.reload();
      else setMessage(t(mode === "reset" ? "saved" : "sent"));
    } catch (failure) { setError(failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setError(undefined); setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      membership.reload();
    } catch (failure) { setError(failure instanceof Error ? failure : new Error("SERVER_ERROR")); }
    finally { setBusy(false); }
  }
  return <section className="section account-panel"><p className="eyebrow">{t("account")}</p><h1>{t("join")}</h1>
    <Status loading={membership.loading} error={membership.error}>
      {membership.member ? <>
        <h2>{membership.member.name}</h2><p>{membership.member.email}</p><p className="badge">{t(membership.member.status)} · {t(membership.member.role)} · {t(membership.member.emailVerified ? "verified" : "unverified")}</p>
        <form onSubmit={updateProfile}><label>{t("name")}<input name="name" required maxLength={80} defaultValue={membership.member.name} /></label><button disabled={busy}>{t("save")}</button></form>
        <div className="actions"><button onClick={membership.reload}>{t("refresh")}</button><button disabled={busy} onClick={signOut}>{t("signOut")}</button></div>
      </> : <>
        <p className="notice">{t("registerNote")}</p>
        <div className="tabs">{(["login", "register", "forgot"] as const).map((value) => <button aria-pressed={mode === value} key={value} onClick={() => { setMode(value); setMessage(""); setError(undefined); }}>{t(value === "login" ? "signIn" : value === "register" ? "register" : "forgot")}</button>)}</div>
        <form onSubmit={submit}>
          {mode === "register" && <label>{t("name")}<input name="name" autoComplete="nickname" required maxLength={80} /></label>}
          {mode !== "reset" && <label>{t("email")}<input name="email" type="email" autoComplete="email" required /></label>}
          {mode !== "forgot" && <label>{t(mode === "reset" ? "newPassword" : "password")}<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} /></label>}
          <button className="primary" disabled={busy}>{busy ? t("loading") : t(mode === "login" ? "signIn" : mode === "register" ? "register" : "reset")}</button>
        </form>
      </>}
    </Status><ErrorNotice error={error} />{message && <p role="status" className="notice">{message}</p>}
  </section>;
}
