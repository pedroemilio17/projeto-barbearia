import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "../lib/supabase";

type Role = "admin" | "client";

type AuthContextType = {
  user: any | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<Role>("client");
  const [loading, setLoading] = useState(true);

  async function resolveRole(userId: string): Promise<Role> {
    // tabela profiles (id uuid -> auth.users.id, role text)
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !data?.role) return "client";
    return data.role === "admin" ? "admin" : "client";
  }

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      if (!alive) return;

      setUser(sessionUser);

      if (sessionUser?.id) {
        const userRole = await resolveRole(sessionUser.id);
        if (alive) setRole(userRole);
      } else {
        setRole("client");
      }

      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser?.id) {
        const userRole = await resolveRole(sessionUser.id);
        setRole(userRole);
      } else {
        setRole("client");
      }

      setLoading(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
