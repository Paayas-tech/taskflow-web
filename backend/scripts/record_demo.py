"""Record a polished TaskFlow product walkthrough as a Full HD MP4 video.

Credentials are read from TASKFLOW_DEMO_EMAIL and TASKFLOW_DEMO_PASSWORD.
The script intentionally creates a showcase task and updates one existing task.
Use a disposable/demo workspace account when recording portfolio footage.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import imageio_ffmpeg
from playwright.sync_api import Locator, Page, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TASKFLOW_DEMO_URL", "https://taskflow.bohaus.in").rstrip("/")
EMAIL = os.environ.get("TASKFLOW_DEMO_EMAIL", "test@bohaus.in").strip()
PASSWORD = os.environ.get("TASKFLOW_DEMO_PASSWORD", "")
PROJECT_NAME = os.environ.get("TASKFLOW_DEMO_PROJECT", "").strip()
EXISTING_TASK = os.environ.get("TASKFLOW_DEMO_EXISTING_TASK", "").strip()
OUTPUT_DIR = Path(os.environ.get("TASKFLOW_DEMO_OUTPUT", "recordings")).resolve()
TASK_TITLE = os.environ.get(
    "TASKFLOW_DEMO_TASK_TITLE", "Implement Automated Database Backups"
).strip()
HEADLESS = os.environ.get("TASKFLOW_DEMO_HEADLESS", "1").strip().lower() not in {
    "0",
    "false",
    "no",
}


def pause(page: Page, milliseconds: int = 1_200) -> None:
    page.wait_for_timeout(milliseconds)


def human_click(page: Page, locator: Locator, pause_after: int = 700) -> None:
    locator.wait_for(state="visible")
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    if box:
        page.mouse.move(
            box["x"] + box["width"] / 2,
            box["y"] + box["height"] / 2,
            steps=18,
        )
        page.wait_for_timeout(180)
    locator.click()
    pause(page, pause_after)


def human_fill(page: Page, locator: Locator, value: str, *, type_slowly: bool = True) -> None:
    human_click(page, locator, pause_after=180)
    locator.fill("")
    if type_slowly:
        locator.press_sequentially(value, delay=42)
    else:
        # Passwords can contain keyboard-modifier characters such as `!`.
        # Atomic fill is more reliable than synthesizing those key chords.
        locator.fill(value)
    pause(page, 350)


def install_demo_cursor(page: Page) -> None:
    page.add_init_script(
        """
        document.addEventListener("DOMContentLoaded", () => {
          const style = document.createElement("style");
          style.textContent = `
            #taskflow-demo-cursor {
              position: fixed; left: 0; top: 0; z-index: 2147483647;
              width: 18px; height: 18px; border-radius: 50%;
              border: 2px solid rgba(255,255,255,.95);
              background: rgba(92,82,220,.88);
              box-shadow: 0 2px 9px rgba(0,0,0,.32);
              transform: translate(-50%,-50%); pointer-events: none;
              transition: transform 100ms ease, background 100ms ease;
            }
            #taskflow-demo-cursor.is-down {
              transform: translate(-50%,-50%) scale(.72);
              background: rgba(38,190,140,.95);
            }`;
          document.head.appendChild(style);
          const cursor = document.createElement("div");
          cursor.id = "taskflow-demo-cursor";
          document.body.appendChild(cursor);
          addEventListener("pointermove", event => {
            cursor.style.left = `${event.clientX}px`;
            cursor.style.top = `${event.clientY}px`;
          });
          addEventListener("pointerdown", () => cursor.classList.add("is-down"));
          addEventListener("pointerup", () => cursor.classList.remove("is-down"));
        });
        """
    )


def login(page: Page) -> None:
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=45_000)
    page.get_by_text("Welcome back", exact=True).wait_for(timeout=30_000)
    pause(page, 1_300)

    human_fill(page, page.get_by_placeholder("you@example.com"), EMAIL)
    human_fill(
        page,
        page.get_by_placeholder("Enter your password"),
        PASSWORD,
        type_slowly=False,
    )
    human_click(
        page,
        page.locator("form").get_by_role("button", name="Sign in", exact=True),
        pause_after=250,
    )
    try:
        page.get_by_role("navigation", name="Primary").wait_for(timeout=30_000)
    except PlaywrightTimeoutError as error:
        notice = page.locator(".inline-notice, [role='alert']").last
        message = notice.inner_text() if notice.count() else "the dashboard did not load"
        raise RuntimeError(f"Browser login failed: {message}") from error
    page.get_by_role("button", name="New task", exact=True).first.wait_for(timeout=30_000)
    pause(page, 1_800)


def open_project_board(page: Page) -> None:
    human_click(page, page.get_by_role("button", name=re.compile(r"^Projects(?:,|$)")))
    page.get_by_role("heading", name=re.compile(r"^Projects")).wait_for(timeout=20_000)
    pause(page, 1_200)

    if PROJECT_NAME:
        project = page.get_by_role("button", name=f"Open {PROJECT_NAME}", exact=True)
    else:
        project = page.locator(".project-row[role='button']").first
    if project.count() == 0:
        raise RuntimeError("No accessible project was found for the demo account.")

    human_click(page, project, pause_after=800)
    board_tab = page.get_by_role("tab", name=re.compile(r"^Board"))
    human_click(page, board_tab, pause_after=500)
    board = page.get_by_label("Task board")
    board.wait_for(timeout=20_000)
    pause(page, 1_800)

    # Pan across the board and return to the first columns for a natural reveal.
    board.evaluate("element => element.scrollBy({left: 720, behavior: 'smooth'})")
    pause(page, 1_500)
    board.evaluate("element => element.scrollBy({left: -720, behavior: 'smooth'})")
    pause(page, 1_200)


def update_existing_task(page: Page) -> None:
    cards = page.locator("article.task-card[role='button']")
    if EXISTING_TASK:
        card = page.get_by_role("button", name=EXISTING_TASK, exact=True)
    else:
        card = cards.first
    if card.count() == 0:
        raise RuntimeError("The selected project has no task available to demonstrate editing.")

    human_click(page, card, pause_after=700)
    panel = page.get_by_role("complementary", name="Task details")
    panel.wait_for(timeout=15_000)
    pause(page, 1_000)

    description = panel.locator("textarea.panel-description")
    verification_time = datetime.now(UTC).strftime("%H:%M UTC")
    human_fill(
        page,
        description,
        "Automated checks configured for production readiness and reliable recovery. "
        f"Demo verified at {verification_time}.",
    )
    description.press("Tab")
    try:
        panel.get_by_text("Saved", exact=True).wait_for(timeout=12_000)
    except PlaywrightTimeoutError as error:
        raise RuntimeError("The edited task did not report a successful save.") from error
    pause(page, 1_500)
    human_click(page, panel.get_by_role("button", name="Close panel"), pause_after=900)


def create_showcase_task(page: Page) -> str:
    title = TASK_TITLE
    if page.get_by_role("button", name=title, exact=True).count() > 0:
        suffix = datetime.now(UTC).strftime("%Y-%m-%d %H%M")
        title = f"{title} · {suffix}"

    workspace = page.locator(".workspace-tabbar")
    human_click(page, workspace.get_by_role("button", name="New task", exact=True))
    dialog = page.get_by_role("dialog", name="New task")
    dialog.wait_for(timeout=10_000)

    human_fill(page, dialog.get_by_label("Task title"), title)
    human_fill(
        page,
        dialog.get_by_label("Description"),
        "Schedule encrypted PostgreSQL backups with retention checks and restore drills.",
    )
    dialog.get_by_label("Priority", exact=True).select_option("high")
    pause(page, 700)
    with page.expect_response(
        lambda response: response.request.method == "POST"
        and response.url.rstrip("/").endswith("/api/tasks"),
        timeout=20_000,
    ) as response_info:
        human_click(page, dialog.get_by_role("button", name="Create task", exact=True), 400)
    response = response_info.value
    if not response.ok:
        try:
            payload = response.json()
            detail = str(payload.get("detail") or payload.get("error") or "")
        except Exception:
            detail = ""
        suffix = f": {detail}" if detail else ""
        raise RuntimeError(f"Task creation failed (HTTP {response.status}){suffix}")
    dialog.wait_for(state="hidden", timeout=20_000)
    page.get_by_role("button", name=title, exact=True).wait_for(timeout=20_000)
    pause(page, 2_200)
    return title


def transcode_to_mp4(source: Path, destination: Path) -> None:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(source),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        str(destination),
    ]
    subprocess.run(command, check=True, capture_output=True)


def verify_credentials(context) -> None:
    """Fail before video capture when the demo credentials are not accepted."""
    response = context.request.post(
        f"{BASE_URL}/api/auth/login",
        data={"email": EMAIL, "password": PASSWORD},
        timeout=30_000,
    )
    if response.ok:
        return
    detail = ""
    try:
        payload = response.json()
        detail = str(payload.get("detail") or payload.get("error") or "")
    except Exception:
        detail = ""
    suffix = f": {detail}" if detail else ""
    raise RuntimeError(f"Demo credentials were rejected (HTTP {response.status}){suffix}")


def main() -> int:
    if not PASSWORD:
        print(
            "Set TASKFLOW_DEMO_PASSWORD before recording. "
            "Credentials are deliberately not stored in this script.",
            file=sys.stderr,
        )
        return 2

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    mp4_path = OUTPUT_DIR / f"taskflow-demo-{stamp}.mp4"
    raw_video: Path | None = None
    failure: Exception | None = None

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=HEADLESS,
            args=["--disable-notifications", "--force-device-scale-factor=1"],
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            screen={"width": 1920, "height": 1080},
            device_scale_factor=1,
            record_video_dir=str(OUTPUT_DIR),
            record_video_size={"width": 1920, "height": 1080},
            color_scheme="light",
        )
        try:
            verify_credentials(context)
        except Exception as error:
            context.close()
            browser.close()
            print(str(error), file=sys.stderr)
            return 2

        page = context.new_page()
        video = page.video
        install_demo_cursor(page)

        try:
            login(page)
            open_project_board(page)
            update_existing_task(page)
            created_title = create_showcase_task(page)
            print(f'Created showcase task: "{created_title}"')
        except Exception as error:  # Close the context even after a partial recording.
            failure = error
            try:
                page.screenshot(path=str(OUTPUT_DIR / f"taskflow-demo-error-{stamp}.png"))
            except Exception:
                pass
        finally:
            context.close()
            if video is not None:
                raw_video = Path(video.path())
            browser.close()

    if raw_video is None or not raw_video.exists():
        print("Playwright did not produce a video file.", file=sys.stderr)
        return 1

    try:
        transcode_to_mp4(raw_video, mp4_path)
    finally:
        if raw_video != mp4_path:
            raw_video.unlink(missing_ok=True)

    print(f"Demo video saved to: {mp4_path}")
    if failure is not None:
        print(f"Walkthrough failed after recording partial footage: {failure}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
