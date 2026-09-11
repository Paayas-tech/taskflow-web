import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createTaskFlowApi } from "@taskflow/api-client";

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const hasApiConfiguration = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

let apiInstance: ReturnType<typeof createTaskFlowApi> | null = null;

export const getApi = () => {
  if (!hasApiConfiguration) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  apiInstance ??= createTaskFlowApi({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    storage,
  });
  return apiInstance;
};
