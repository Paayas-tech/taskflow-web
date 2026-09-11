import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getApi } from "../lib/api";

interface AuthContextValue {
  authenticated: boolean;
  email: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    try {
      const api = getApi();
      void api.supabase.auth.getSession()
        .then(({ data }) => {
          if (!active) return;
          setAuthenticated(Boolean(data.session));
          setEmail(data.session?.user.email ?? null);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setAuthenticated(false);
          setEmail(null);
          setLoading(false);
        });

      const { data } = api.supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setAuthenticated(Boolean(session));
        setEmail(session?.user.email ?? null);
        setLoading(false);
      });

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch {
      setLoading(false);
      return () => {
        active = false;
      };
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authenticated,
    email,
    loading,
    login: async (loginEmail, password) => {
      const result = await getApi().login(loginEmail, password);
      setAuthenticated(true);
      setEmail(result.user.email || null);
    },
    logout: async () => {
      await getApi().logout();
      setAuthenticated(false);
      setEmail(null);
    },
  }), [authenticated, email, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
