import { listRepository } from "../infrastructure/supabase/listRepository";

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);
const normalizeName = (name) => String(name || "").trim();
const normalizePosition = (position, fallback = null) => {
  if (position === null || position === undefined || position === "") {
    return fallback;
  }
  const value = Number(position);
  return Number.isFinite(value) ? value : fallback;
};

export const normalizeListRow = (row = {}) => ({
  id: row.id,
  name: row.name || "Untitled list",
  color: row.color || "",
  position: normalizePosition(row.position),
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

export const createListService = (repository) => ({
  async getLists(userId) {
    const rows = await repository.getLists(userId);
    return rows.map(normalizeListRow);
  },

  async createList(userId, listData = {}) {
    const name = normalizeName(listData.name);
    if (!name) throw new Error("List name cannot be empty.");
    const row = await repository.createList(userId, {
      name,
      color: listData.color || "",
      position: normalizePosition(listData.position, 0),
    });
    return { id: row.id };
  },

  async updateList(userId, listId, data = {}) {
    const values = {};
    ["name", "color", "position"].forEach((field) => {
      if (hasOwn(data, field)) values[field] = data[field];
    });
    if (hasOwn(values, "name")) {
      values.name = normalizeName(values.name);
      if (!values.name) throw new Error("List name cannot be empty.");
    }
    if (hasOwn(values, "position")) {
      values.position = normalizePosition(values.position, 0);
    }
    return repository.updateList(userId, listId, values);
  },

  deleteList: (userId, listId) => repository.deleteList(userId, listId),
});

const supabaseListService = createListService(listRepository);

export const getLists = (...args) => supabaseListService.getLists(...args);
export const createList = (...args) => supabaseListService.createList(...args);
export const updateList = (...args) => supabaseListService.updateList(...args);
export const deleteList = (...args) => supabaseListService.deleteList(...args);
