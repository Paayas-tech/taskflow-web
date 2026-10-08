export const apiBaseUrl=String(import.meta.env?.VITE_API_BASE_URL||"/api").trim().replace(/\/+$/u,"");
const TOKEN_KEY="taskflow.accessToken",USER_KEY="taskflow.user";
export const isApiConfigured=true;
export const isSupabaseConfigured=isApiConfigured;
export const getAccessToken=()=>localStorage.getItem(TOKEN_KEY)||"";
export const getCachedUser=()=>{try{return JSON.parse(localStorage.getItem(USER_KEY)||"null");}catch{return null;}};
export const setSession=(token,user)=>{if(token)localStorage.setItem(TOKEN_KEY,token);if(user)localStorage.setItem(USER_KEY,JSON.stringify(user));};
export const clearSession=()=>{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);};
export const apiRequest = async (path, options = {}) => {
  const { timeoutMs = path === "/chat" ? 60000 : 15000, signal, ...request } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  const headers = new Headers(request.headers || {}), token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (request.body && !headers.has("Content-Type") && !(request.body instanceof FormData)) headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...request, headers, signal: controller.signal });
    if (response.status === 204) return null;
    let data;
    try { data = await response.json(); } catch (value) {
      if (controller.signal.aborted) throw value;
      const error = new Error("TaskFlow API returned an invalid response."); error.status = response.status; throw error;
    }
    if (!response.ok) { const error = new Error(String(data?.detail || data?.error || "TaskFlow API request failed.")); error.status = response.status; throw error; }
    return data;
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error("TaskFlow took too long to respond. Please try again.");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
};
export const currentUserId=async()=>getCachedUser()?.id||null;
export const subscribeToTable=({onChange,onStatus})=>{onStatus?.("SUBSCRIBED");const timer=setInterval(()=>onChange?.({eventType:"POLL"}),30000);return()=>clearInterval(timer);};
export const throwIfError=(error)=>{if(error)throw error;};
