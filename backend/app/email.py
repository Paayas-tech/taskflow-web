import html
import logging
import os
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from typing import Awaitable, Callable

import aiosmtplib

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "postfix").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_START_TLS = os.getenv("SMTP_START_TLS", "false").strip().lower() in {
    "1",
    "true",
    "yes",
}
SMTP_TIMEOUT_SECONDS = float(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
EMAIL_FROM = os.getenv("EMAIL_FROM", "TaskFlow <noreply@bohaus.in>").strip()
APP_URL = os.getenv("PUBLIC_APP_URL", "https://taskflow.bohaus.in").strip().rstrip("/")
UNSUBSCRIBE_URL = os.getenv(
    "EMAIL_UNSUBSCRIBE_URL", f"{APP_URL}/settings"
).strip()


def _message(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str,
    list_unsubscribe: str | None = None,
) -> EmailMessage:
    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain="bohaus.in")
    if list_unsubscribe:
        message["List-Unsubscribe"] = f"<{list_unsubscribe}>"
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    return message


async def send_email(message: EmailMessage) -> None:
    await aiosmtplib.send(
        message,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        start_tls=SMTP_START_TLS,
        timeout=SMTP_TIMEOUT_SECONDS,
    )


async def send_safely(
    operation: Callable[[], Awaitable[None]], *, event: str, recipient: str
) -> bool:
    try:
        await operation()
        logger.info("Transactional email queued: event=%s recipient=%s", event, recipient)
        return True
    except Exception:
        logger.exception(
            "Transactional email delivery failed: event=%s recipient=%s",
            event,
            recipient,
        )
        return False


async def send_login_otp(to: str, otp: str) -> None:
    safe_otp = html.escape(otp)
    await send_email(
        _message(
            to=to,
            subject="Your TaskFlow login code",
            text_body=f"Your TaskFlow login code is {otp}. It expires shortly.",
            html_body=(
                "<p>Your TaskFlow login code is:</p>"
                f"<p><strong style=\"font-size:24px\">{safe_otp}</strong></p>"
                "<p>This code expires shortly. If you did not request it, ignore this email.</p>"
            ),
        )
    )


async def send_registration_otp(to: str, otp: str) -> None:
    safe_otp = html.escape(otp)
    await send_email(
        _message(
            to=to,
            subject="Confirm your TaskFlow account",
            text_body=f"Use verification code {otp} to finish creating your TaskFlow account.",
            html_body=(
                "<p>Welcome to TaskFlow.</p>"
                f"<p>Use verification code <strong>{safe_otp}</strong> to finish creating your account.</p>"
            ),
        )
    )


async def send_password_reset(to: str, reset_url: str) -> None:
    safe_url = html.escape(reset_url, quote=True)
    await send_email(
        _message(
            to=to,
            subject="Reset your TaskFlow password",
            text_body=f"Reset your TaskFlow password: {reset_url}\n\nIf you did not request this, ignore this email.",
            html_body=(
                "<p>We received a request to reset your TaskFlow password.</p>"
                f"<p><a href=\"{safe_url}\">Reset password</a></p>"
                "<p>If you did not request this, ignore this email.</p>"
            ),
        )
    )


async def send_project_invitation(
    to: str, *, project_name: str, inviter_name: str, role: str
) -> None:
    safe_project = html.escape(project_name)
    safe_inviter = html.escape(inviter_name)
    safe_role = html.escape(role)
    invite_url = f"{APP_URL}/projects"
    await send_email(
        _message(
            to=to,
            subject=f"You were invited to {project_name} in TaskFlow",
            text_body=(
                f"{inviter_name} invited you to {project_name} as {role}.\n\n"
                f"Open TaskFlow to accept the invitation: {invite_url}"
            ),
            html_body=(
                f"<p><strong>{safe_inviter}</strong> invited you to "
                f"<strong>{safe_project}</strong> as <strong>{safe_role}</strong>.</p>"
                f"<p><a href=\"{invite_url}\">Open TaskFlow</a> to accept the invitation.</p>"
            ),
            list_unsubscribe=UNSUBSCRIBE_URL,
        )
    )


async def send_task_assignment(
    to: str, *, task_title: str, project_name: str, task_url: str
) -> None:
    safe_title = html.escape(task_title)
    safe_project = html.escape(project_name)
    safe_url = html.escape(task_url, quote=True)
    await send_email(
        _message(
            to=to,
            subject=f"Task assigned: {task_title}",
            text_body=(
                f"You were assigned {task_title} in {project_name}.\n\n"
                f"Open the task: {task_url}"
            ),
            html_body=(
                f"<p>You were assigned <strong>{safe_title}</strong> in "
                f"<strong>{safe_project}</strong>.</p>"
                f"<p><a href=\"{safe_url}\">Open task</a></p>"
            ),
            list_unsubscribe=UNSUBSCRIBE_URL,
        )
    )


async def send_project_invitation_safely(
    to: str, *, project_name: str, inviter_name: str, role: str
) -> bool:
    return await send_safely(
        lambda: send_project_invitation(
            to,
            project_name=project_name,
            inviter_name=inviter_name,
            role=role,
        ),
        event="project_invitation",
        recipient=to,
    )


async def send_task_assignment_safely(
    to: str, *, task_title: str, project_name: str, task_url: str
) -> bool:
    return await send_safely(
        lambda: send_task_assignment(
            to,
            task_title=task_title,
            project_name=project_name,
            task_url=task_url,
        ),
        event="task_assignment",
        recipient=to,
    )
