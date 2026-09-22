import{apiRequest,apiBaseUrl,getAccessToken}from"./client";
const map=(r={})=>({id:r.id,projectId:r.project_id,entityType:r.entity_type,entityId:r.entity_id,storagePath:r.storage_path,fileName:r.file_name,contentType:r.content_type||"application/octet-stream",sizeBytes:Number(r.size_bytes)||0,uploadedBy:r.uploaded_by,uploaderName:r.display_name||"TaskFlow user",uploaderAvatarUrl:r.avatar_url||"",createdAt:r.created_at});
export const listAttachments=async(c)=>(await apiRequest(`/attachments?projectId=${c.projectId}&entityType=${c.entityType}&entityId=${c.entityId}`)).map(map);
export const listTaskAttachmentCounts=async(projectId)=>{const rows=(await apiRequest(`/attachments?projectId=${projectId}&entityType=task`));return rows.reduce((a,r)=>{a[r.entity_id]=(a[r.entity_id]||0)+1;return a;},{});};
export const uploadAttachment=async(v)=>{const form=new FormData();form.set("projectId",v.projectId);form.set("entityType",v.entityType);form.set("entityId",v.entityId);form.set("file",v.file);return map(await apiRequest("/attachments",{method:"POST",body:form}));};
export const openAttachment=async(a)=>{const response=await fetch(`${apiBaseUrl}/attachments/${a.id}/content`,{headers:{Authorization:`Bearer ${getAccessToken()}`}});if(!response.ok)throw new Error("This attachment could not be opened.");return URL.createObjectURL(await response.blob());};
export const removeAttachment=(a)=>apiRequest(`/attachments/${a.id}`,{method:"DELETE"});
export const removeAllAttachments=async(c)=>{for(const a of await listAttachments(c))await removeAttachment(a);};
