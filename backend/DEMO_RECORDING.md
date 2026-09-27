# TaskFlow portfolio recording

The recorder signs in, opens a project board, edits an existing task's
description, and creates a high-priority task named **Implement Automated
Database Backups**. Run it with a disposable demo account or workspace because
those changes are intentionally persisted for the showcase.

## Install

From the repository root in PowerShell:

```powershell
python -m pip install -r backend/requirements-demo.txt; if ($LASTEXITCODE -eq 0) { python -m playwright install chromium }
```

## Record

Keep credentials out of the script and command history by setting them only in
the current PowerShell process:

```powershell
$env:TASKFLOW_DEMO_EMAIL = "test@bohaus.in"
$env:TASKFLOW_DEMO_PASSWORD = Read-Host "Demo password" -MaskInput
python backend/scripts/record_demo.py
```

Windows PowerShell 5 does not support `-MaskInput`; use the following instead:

```powershell
$secure = Read-Host "Demo password" -AsSecureString
$env:TASKFLOW_DEMO_PASSWORD = [Net.NetworkCredential]::new("", $secure).Password
python backend/scripts/record_demo.py
```

The script records at 1920×1080, converts Playwright's intermediate WebM to an
H.264 MP4, prints the absolute output path, and stores the result under
`recordings/`. The directory is ignored by Git.

Optional environment variables:

- `TASKFLOW_DEMO_URL` — defaults to `https://taskflow.bohaus.in`.
- `TASKFLOW_DEMO_PROJECT` — exact project name; otherwise the first visible project is used.
- `TASKFLOW_DEMO_EXISTING_TASK` — exact task title to edit; otherwise the first card is used.
- `TASKFLOW_DEMO_TASK_TITLE` — title for the created showcase task.
- `TASKFLOW_DEMO_OUTPUT` — output directory; defaults to `recordings`.
- `TASKFLOW_DEMO_HEADLESS=0` — display Chromium while recording.

Clear the password when recording is finished:

```powershell
Remove-Item Env:TASKFLOW_DEMO_PASSWORD
```
