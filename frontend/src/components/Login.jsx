import { useState } from "react";

// Demo admin gate. NOTE: this is a client-side mock for a prototype — the
// credentials live in the bundle and provide no real security. Swap for a real
// auth backend before any sensitive deployment.
export const ADMIN = { email: "idsp@admin", password: "admin123" };

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN.email && pw === ADMIN.password) {
      setErr("");
      onLogin();
    } else {
      setErr("Invalid email or password.");
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span className="brand-mark" /> Disease Surveillance</div>
        <h1>IDSP Admin sign in</h1>
        <p className="login-sub">Sign in to access the surveillance dashboard.</p>

        <label className="login-field">
          <span>Admin ID</span>
          <input type="text" autoComplete="username" autoFocus value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="idsp@admin" />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={pw}
                 onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </label>

        {err && <div className="login-err">{err}</div>}
        <button type="submit" className="login-btn">Sign in</button>
      </form>
    </div>
  );
}
