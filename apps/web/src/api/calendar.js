import{apiRequest}from"./client";
export const getGoogleConnection=()=>apiRequest("/calendar/google");
export const startGoogleOAuth=async()=>{const data=await apiRequest("/calendar/google/connect",{method:"POST"});if(!data?.authorizationUrl)throw new Error("Google Calendar is not configured for this TaskFlow environment yet.");return data.authorizationUrl;};
export const syncGoogleCalendar=()=>apiRequest("/calendar/google/sync",{method:"POST"});
export const disconnectGoogleCalendar=()=>apiRequest("/calendar/google",{method:"DELETE"});
