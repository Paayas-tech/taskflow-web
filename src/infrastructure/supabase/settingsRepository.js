import { requireSupabase } from "./client";

const throwIfError = (error) => {
  if (error) throw error;
};

export const createSettingsRepository = (client = null) => {
  const database = () => client || requireSupabase();

  return {
    async getSettings(userId) {
      const { data, error } = await database()
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      throwIfError(error);
      return data || null;
    },

    async saveSettings(userId, values) {
      const { data, error } = await database()
        .from("user_settings")
        .upsert(
          { ...values, user_id: userId },
          { onConflict: "user_id" }
        )
        .select("*")
        .single();
      throwIfError(error);
      return data;
    },
  };
};

export const settingsRepository = createSettingsRepository();
