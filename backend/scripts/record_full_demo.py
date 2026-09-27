import os
import sys
import time
import argparse
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

# Setup base directories
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
RECORDINGS_DIR = ROOT_DIR / "recordings"
RAW_DIR = RECORDINGS_DIR / "raw"
TITLES_DIR = RECORDINGS_DIR / "titles"
NORMALIZED_DIR = RECORDINGS_DIR / "normalized"

for d in [RAW_DIR, TITLES_DIR, NORMALIZED_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Environment & Config
BASE_URL = os.getenv("TASKFLOW_BASE_URL", "https://taskflow.bohaus.in")
EMAIL = os.getenv("TASKFLOW_DEMO_EMAIL", "test@bohaus.in")
PASSWORD = os.getenv("TASKFLOW_DEMO_PASSWORD", "MailPassword123!")

VIEWPORT = {"width": 1920, "height": 1080}

STEPS = [
    {
        "id": "01-login-home",
        "title": "01 | Authentication & Dashboard",
        "subtitle": "Self-hosted JWT session flow and overview metrics",
    },
    {
        "id": "02-projects-overview",
        "title": "02 | Projects & Workspaces",
        "subtitle": "Multi-project tracking, team access, and status indicators",
    },
    {
        "id": "03-board-tasks",
        "title": "03 | Kanban Board & Task Drawer",
        "subtitle": "Real-time task mutations, column reordering, and detail modals",
    },
    {
        "id": "04-list-stories",
        "title": "04 | Structured List & Story Backlog",
        "subtitle": "Granular multi-field filters and epic/story hierarchy",
    },
    {
        "id": "05-my-tasks-calendar",
        "title": "05 | My Tasks & Calendar Schedule",
        "subtitle": "Personalized workload views and deadline scheduling",
    },
    {
        "id": "06-inbox-collaboration",
        "title": "06 | Activity Feed & Collaboration",
        "subtitle": "Threaded discussions, real-time mentions, and notifications",
    },
    {
        "id": "07-ai-assistant",
        "title": "07 | AI Workflow Assistant",
        "subtitle": "Automated task decomposition and standup summaries",
    },
    {
        "id": "08-settings-finale",
        "title": "08 | Workspace Settings & Summary",
        "subtitle": "System configuration and production deployment wrap-up",
    },
]

def human_delay(seconds: float = 1.0):
    time.sleep(seconds)

def login_if_needed(page):
    page.goto(f"{BASE_URL}/login")
    human_delay(1.5)
    if page.locator("input[type='email']").is_visible():
        page.fill("input[type='email']", EMAIL)
        human_delay(0.5)
        page.fill("input[type='password']", PASSWORD)
        human_delay(0.5)
        page.keyboard.press("Enter")
        page.wait_for_load_state("networkidle")
        human_delay(2)

def record_clip(step_id: str, output_path: Path):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=str(RAW_DIR),
            record_video_size=VIEWPORT
        )
        page = context.new_page()

        print(f"--> Recording [{step_id}]...")

        if step_id == "01-login-home":
            page.goto(f"{BASE_URL}/login")
            human_delay(1.5)
            if page.locator("input[type='email']").is_visible():
                page.fill("input[type='email']", EMAIL)
                human_delay(0.6)
                page.fill("input[type='password']", PASSWORD)
                human_delay(0.8)
                page.keyboard.press("Enter")
            page.wait_for_load_state("networkidle")
            human_delay(2.5)
            page.mouse.move(400, 250)
            human_delay(1)
            page.mouse.move(700, 250)
            human_delay(1.5)

        elif step_id == "02-projects-overview":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/projects")
            page.wait_for_load_state("networkidle")
            human_delay(2)
            page.mouse.wheel(0, 300)
            human_delay(1.5)
            first_project = page.locator("a[href*='/projects/']").first
            if first_project.is_visible():
                first_project.click()
                page.wait_for_load_state("networkidle")
                human_delay(2.5)

        elif step_id == "03-board-tasks":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/board")
            page.wait_for_load_state("networkidle")
            human_delay(2)
            card = page.locator("[data-testid='task-card'], .task-card").first
            if card.is_visible():
                card.click()
                human_delay(2)
                page.keyboard.press("Escape")
                human_delay(1)

        elif step_id == "04-list-stories":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/list")
            page.wait_for_load_state("networkidle")
            human_delay(2)
            page.mouse.wheel(0, 250)
            human_delay(1.5)

        elif step_id == "05-my-tasks-calendar":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/calendar")
            page.wait_for_load_state("networkidle")
            human_delay(2.5)
            page.mouse.move(500, 400)
            human_delay(1.5)

        elif step_id == "06-inbox-collaboration":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/inbox")
            page.wait_for_load_state("networkidle")
            human_delay(2.5)

        elif step_id == "07-ai-assistant":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/assistant")
            page.wait_for_load_state("networkidle")
            human_delay(3)

        elif step_id == "08-settings-finale":
            login_if_needed(page)
            page.goto(f"{BASE_URL}/settings")
            page.wait_for_load_state("networkidle")
            human_delay(2)
            page.goto(f"{BASE_URL}/board")
            page.wait_for_load_state("networkidle")
            human_delay(3)

        video_path = page.video.path()
        context.close()
        browser.close()

        if Path(video_path).exists():
            if output_path.exists():
                output_path.unlink()
            Path(video_path).rename(output_path)
            print(f"Saved: {output_path.name}")

def generate_title_card(title: str, subtitle: str, output_file: Path):
    from PIL import Image, ImageDraw, ImageFont

    # Create dark slate canvas (#0f172a)
    img = Image.new("RGB", (1920, 1080), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)

    # Load system font with safe fallbacks
    try:
        font_title = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 54)
        font_sub = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 30)
    except Exception:
        font_title = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # Center text
    bbox_title = draw.textbbox((0, 0), title, font=font_title)
    w_title = bbox_title[2] - bbox_title[0]
    bbox_sub = draw.textbbox((0, 0), subtitle, font=font_sub)
    w_sub = bbox_sub[2] - bbox_sub[0]

    draw.text(((1920 - w_title) / 2, 480), title, fill=(255, 255, 255), font=font_title)
    draw.text(((1920 - w_sub) / 2, 560), subtitle, fill=(148, 163, 184), font=font_sub)

    temp_png = output_file.with_suffix(".png")
    img.save(temp_png)

    # Encode 2.5s clip with silent audio
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(temp_png),
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-c:v", "libx264", "-t", "2.5", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        str(output_file)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    temp_png.unlink(missing_ok=True)
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "color=c=0x0f172a:s=1920x1080:d=2.5",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", (
            f"drawtext=fontfile='{font_path}':text='{clean_title}':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2-40,"
            f"drawtext=fontfile='{font_path}':text='{clean_sub}':fontcolor=0x94a3b8:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+40"
        ),
        "-c:v", "libx264", "-t", "2.5", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        str(output_file)
    ]
    subprocess.run(cmd, check=True)
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "color=c=0x0f172a:s=1920x1080:d=2.5",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", (
            f"drawtext=text='{clean_title}':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2-40,"
            f"drawtext=text='{clean_sub}':fontcolor=0x94a3b8:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+40"
        ),
        "-c:v", "libx264", "-t", "2.5", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        str(output_file)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

def normalize_video(input_file: Path, output_file: Path):
    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_file),
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        str(output_file)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

def stitch_pipeline():
    concat_list_file = RECORDINGS_DIR / "concat_list.txt"
    entries = []

    print("\n--> Preparing clips and title cards...")
    for step in STEPS:
        sid = step["id"]
        raw_clip = RAW_DIR / f"{sid}.mp4"
        title_card = TITLES_DIR / f"{sid}_title.mp4"
        norm_title = NORMALIZED_DIR / f"{sid}_title_norm.mp4"
        norm_clip = NORMALIZED_DIR / f"{sid}_clip_norm.mp4"

        generate_title_card(step["title"], step["subtitle"], title_card)
        normalize_video(title_card, norm_title)
        entries.append(f"file '{norm_title.as_posix()}'")

        if raw_clip.exists():
            normalize_video(raw_clip, norm_clip)
            entries.append(f"file '{norm_clip.as_posix()}'")
        else:
            print(f"Warning: Raw clip {raw_clip.name} not found, skipping in final edit.")

    with open(concat_list_file, "w") as f:
        f.write("\n".join(entries))

    final_video = RECORDINGS_DIR / "taskflow-complete-demo.mp4"
    print("\n--> Concatenating into final portfolio video...")
    concat_cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_list_file),
        "-c", "copy",
        str(final_video)
    ]
    subprocess.run(concat_cmd, check=True)
    print(f"\n[SUCCESS] Final portfolio video ready: {final_video}")

def main():
    parser = argparse.ArgumentParser(description="Taskflow Portfolio Demo Recorder")
    parser.add_argument("--step", type=str, help="Record only a specific step ID")
    parser.add_argument("--stitch-only", action="store_true", help="Only generate titles and stitch without recording")
    parser.add_argument("--force", action="store_true", help="Re-record all steps even if raw clips exist")
    args = parser.parse_args()

    if not args.stitch_only:
        steps_to_run = [s for s in STEPS if s["id"] == args.step] if args.step else STEPS
        for s in steps_to_run:
            out_file = RAW_DIR / f"{s['id']}.mp4"
            if out_file.exists() and not args.force and not args.step:
                print(f"Skipping {s['id']} (already exists). Use --force to record from scratch.")
                continue
            record_clip(s["id"], out_file)

    stitch_pipeline()

if __name__ == "__main__":
    main()