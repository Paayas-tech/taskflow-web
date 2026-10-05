import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from app.email import (
    _message,
    send_project_invitation,
    send_project_invitation_safely,
    send_safely,
)


class EmailTests(unittest.TestCase):
    def test_message_has_rfc_headers_and_multipart_body(self):
        message = _message(
            to="person@example.com",
            subject="TaskFlow test",
            text_body="Plain text",
            html_body="<p>HTML</p>",
            list_unsubscribe="https://taskflow.bohaus.in/settings",
        )

        self.assertEqual(message["From"], "TaskFlow <noreply@bohaus.in>")
        self.assertEqual(message["To"], "person@example.com")
        self.assertIsNotNone(message["Date"])
        self.assertTrue(message["Message-ID"].endswith("@bohaus.in>"))
        self.assertEqual(
            message["List-Unsubscribe"],
            "<https://taskflow.bohaus.in/settings>",
        )
        self.assertTrue(message.is_multipart())
        self.assertEqual(message.get_body(preferencelist=("plain",)).get_content().strip(), "Plain text")
        self.assertEqual(message.get_body(preferencelist=("html",)).get_content().strip(), "<p>HTML</p>")

    @patch("app.email.aiosmtplib.send", new_callable=AsyncMock)
    def test_project_invitation_uses_local_smtp(self, smtp_send):
        asyncio.run(
            send_project_invitation(
                "person@example.com",
                project_name="Web revamp",
                inviter_name="Paayas",
                role="editor",
            )
        )

        smtp_send.assert_awaited_once()
        _, kwargs = smtp_send.await_args
        self.assertEqual(kwargs["hostname"], "postfix")
        self.assertEqual(kwargs["port"], 587)
        self.assertFalse(kwargs["start_tls"])

    def test_safe_delivery_does_not_raise(self):
        async def fails():
            raise OSError("SMTP unavailable")

        delivered = asyncio.run(
            send_safely(fails, event="test", recipient="person@example.com")
        )
        self.assertFalse(delivered)

    @patch("app.email.send_project_invitation", new_callable=AsyncMock)
    def test_safe_invitation_wrapper_awaits_delivery(self, invitation):
        delivered = asyncio.run(
            send_project_invitation_safely(
                "person@example.com",
                project_name="Web revamp",
                inviter_name="Paayas",
                role="editor",
            )
        )
        self.assertTrue(delivered)
        invitation.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
