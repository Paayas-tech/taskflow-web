import { describe, expect, it, vi } from "vitest";
import { createListService } from "./listService";

describe("Supabase list application service", () => {
  it("normalizes reads to the existing list contract", async () => {
    const repository = {
      getLists: vi.fn().mockResolvedValue([
        {
          id: "list-a",
          name: "Work",
          color: "#123456",
          position: 1,
          created_at: "2026-08-17T00:00:00.000Z",
          updated_at: "2026-08-17T01:00:00.000Z",
        },
      ]),
    };
    const service = createListService(repository);

    await expect(service.getLists("user-a")).resolves.toEqual([
      {
        id: "list-a",
        name: "Work",
        color: "#123456",
        position: 1,
        createdAt: "2026-08-17T00:00:00.000Z",
        updatedAt: "2026-08-17T01:00:00.000Z",
      },
    ]);
  });

  it("validates names and delegates create and delete", async () => {
    const repository = {
      createList: vi.fn().mockResolvedValue({ id: "list-a" }),
      deleteList: vi.fn().mockResolvedValue(undefined),
    };
    const service = createListService(repository);

    await expect(
      service.createList("user-a", { name: " Work ", position: "2" })
    ).resolves.toEqual({ id: "list-a" });
    expect(repository.createList).toHaveBeenCalledWith("user-a", {
      name: "Work",
      color: "",
      position: 2,
    });
    await service.deleteList("user-a", "list-a");
    expect(repository.deleteList).toHaveBeenCalledWith("user-a", "list-a");
  });
});
