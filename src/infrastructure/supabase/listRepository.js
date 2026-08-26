import { requireSupabase } from "./client";

const throwIfError = (error) => {
  if (error) throw error;
};

export const createListRepository = (client = null) => {
  const database = () => client || requireSupabase();

  return {
    async getLists(userId) {
      const { data, error } = await database()
        .from("lists")
        .select("id, name, color, position, created_at, updated_at")
        .eq("user_id", userId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      throwIfError(error);
      return data || [];
    },

    async createList(userId, values) {
      const { data, error } = await database()
        .from("lists")
        .insert({ ...values, user_id: userId })
        .select("id, name, color, position, created_at, updated_at")
        .single();
      throwIfError(error);
      return data;
    },

    async updateList(userId, listId, values) {
      const { data, error } = await database()
        .from("lists")
        .update(values)
        .eq("id", listId)
        .eq("user_id", userId)
        .select("id, name, color, position, created_at, updated_at")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected list is unavailable.");
      return data;
    },

    async deleteList(userId, listId) {
      // task_list_placements.list_id cascades on delete. Tasks remain intact,
      // so their derived listId becomes null (Inbox) on the next load.
      const { data, error } = await database()
        .from("lists")
        .delete()
        .eq("id", listId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error("The selected list is unavailable.");
    },
  };
};

export const listRepository = createListRepository();
