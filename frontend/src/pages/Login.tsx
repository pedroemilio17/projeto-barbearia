import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Falha ao autenticar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Entrar</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Faça login para continuar o agendamento.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            placeholder="Seu e-mail"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Sua senha"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 py-2 font-semibold disabled:opacity-60"
          >
            {busy ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          className="mt-4 text-sm underline"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
        >
          {mode === "login" ? "Não tenho conta" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}
