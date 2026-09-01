# TaskFlow attachments deployment

TaskFlow supports private attachments on projects, Stories, and project tasks. Files are stored in Supabase Storage; file metadata and permissions are stored in Postgres.

## Required migrations

Apply the migrations in order through the normal Supabase migration workflow:

1. `supabase/migrations/015_attachments.sql` creates the metadata table, private bucket configuration, validation, and access policies.
2. `supabase/migrations/016_attachment_storage_hardening.sql` validates complete Storage paths and prevents direct uploads to missing, mismatched, or cross-project entities.

Do not paste tokens, service-role keys, signed file links, or other secrets into migration commands, logs, issues, or this document.

## Storage configuration

- Bucket: `taskflow-attachments`
- Public access: disabled
- Maximum file size: 10 MiB (10,485,760 bytes)
- Allowed formats: PDF, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX, PNG, JPEG, and WebP
- Object path: `projects/<project-id>/<project|story|task>/<entity-id>/<attachment-id>-<safe-file-name>`
- File access: short-lived signed URLs generated on demand; the application does not persist them

The migrations create or update the bucket configuration. Confirm the bucket is still private in the Supabase dashboard after applying them.

## Safe deployment

1. Back up the database and review the target environment.
2. Run the database tests against a disposable/local Supabase instance.
3. Apply pending migrations to a staging project using the repository's normal migration command.
4. In Storage, confirm the bucket is private, has a 10 MiB limit, and has the expected MIME allowlist.
5. Test one project, Story, and task attachment as an owner/editor. Confirm upload, open, and delete.
6. Test as a viewer: listing/opening must work, while add/delete controls remain unavailable and direct writes are denied.
7. Test as a non-member: metadata and files must not be visible.
8. Promote the same migrations to production through the normal reviewed release process.

This repository does not require public Storage URLs or browser-side secrets.

## Permission matrix

| Role | List/open | Upload | Delete |
| --- | --- | --- | --- |
| Project owner | Yes | Yes | Yes |
| Project editor | Yes | Yes | Yes |
| Project viewer | Yes | No | No |
| Non-member | No | No | No |

The UI applies the same owner/editor/viewer rules, while RLS and Storage policies remain the enforcement boundary.

## Cleanup behavior and limitations

Normal TaskFlow deletion flows remove Storage objects before deleting their metadata or parent entity. If metadata creation fails after an upload, the service attempts to remove the uploaded object. If object deletion fails, the visible attachment is retained and the user receives an error.

Deleting rows directly in the database bypasses the browser's Storage cleanup. Database cascades/triggers can remove metadata, but Postgres cannot atomically delete the corresponding Storage object. Direct database deletion of projects, Stories, or tasks can therefore leave orphaned private objects. Use the application deletion flow, or run an administrative orphan-cleanup job after direct database maintenance.

Storage deletion and metadata deletion are separate remote operations. A rare failure after the Storage object is removed but before metadata deletion can leave stale metadata; retry deletion or remove the stale metadata administratively after verifying the object is absent.

## Verification checklist

- Metadata table has RLS enabled.
- Bucket is private and no public URL is used.
- Owners/editors can manage only attachments in their projects.
- Viewers can list/open but cannot upload/delete.
- Non-members cannot list metadata or read objects.
- Cross-project and invalid Story/task paths are rejected.
- Signed URLs expire and are generated only when a user opens a file.
- Exact 10 MiB files are accepted; larger files and unsupported/disguised formats are rejected.

## Disable or rollback safely

To temporarily disable attachments without deleting data, hide/disable the attachment UI in the application and revoke the three attachment Storage policies plus attachment-table write policies in a reviewed follow-up migration. Existing files should remain private and untouched.

Do not drop the bucket or metadata table as an emergency rollback: that is destructive and makes recovery difficult. If a full rollback is required, first export metadata, preserve private objects, deploy code that no longer depends on attachments, and then remove database/storage resources through a separately reviewed migration and maintenance plan.
