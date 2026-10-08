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
  userId: string | null;
  name: string;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("TaskFlow user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getApi().getSession().then((user) => {
      if (!active) return;
      setAuthenticated(Boolean(user));
      setEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      setName(user?.displayName || user?.email.split("@")[0] || "TaskFlow user");
    }).catch((error) => {
      console.error("Mobile auth bootstrap failed:", error);
      if (!active) return;
      setAuthenticated(false);
      setEmail(null);
      setUserId(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    authenticated,
    email,
    userId,
    name,
    loading,
    login: async (loginEmail, password) => {
      const result = await getApi().login(loginEmail, password);
      setAuthenticated(true);
      setEmail(result.user.email || null);
      setUserId(result.user.id);
      setName(result.user.displayName || result.user.email.split("@")[0] || "TaskFlow user");
    },
    logout: async () => {
      try { await getApi().logout(); } finally {
      setAuthenticated(false);
      setEmail(null);
      setUserId(null);
      setName("TaskFlow user");
      }
    },
  }), [authenticated, email, loading, name, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
