import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({apiRequest:vi.fn()}));
vi.mock("./client",()=>({apiRequest:mocks.apiRequest,setSession:vi.fn(),clearSession:vi.fn(),getCachedUser:vi.fn()}));
const{exchangeDesktopAuthCode}=await import("./auth");
beforeEach(()=>vi.clearAllMocks());
describe("exchangeDesktopAuthCode",()=>{
 it("exchanges an approved code through the self-hosted API",async()=>{mocks.apiRequest.mockResolvedValue({accessToken:"token",user:{id:"user-1",email:"person@example.com"}});const result=await exchangeDesktopAuthCode("abcdefghijklmnopqrstuvwxyz0123456789");expect(mocks.apiRequest).toHaveBeenCalledWith("/auth/exchange",expect.any(Object));expect(result.user.id).toBe("user-1");});
 it("rejects malformed codes before calling the API",async()=>{await expect(exchangeDesktopAuthCode("short")).rejects.toThrow("Invalid desktop authentication callback.");expect(mocks.apiRequest).not.toHaveBeenCalled();});
});
