import{beforeEach,describe,expect,it,vi}from"vitest";
beforeEach(()=>{localStorage.clear();vi.resetModules();});
describe("self-hosted API client",()=>{
 it("defaults to the same-origin API",async()=>{const client=await import("./client");expect(client.apiBaseUrl).toBe("/api");expect(client.isApiConfigured).toBe(true);});
 it("stores and clears the local JWT session",async()=>{const client=await import("./client");client.setSession("token",{id:"u"});expect(client.getAccessToken()).toBe("token");expect(await client.currentUserId()).toBe("u");client.clearSession();expect(client.getAccessToken()).toBe("");});
});
