#!/usr/bin/env python3
"""Send one SMTP delivery test through the loopback-only Postfix service."""
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
import argparse
import smtplib


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("recipient", help="External mailbox that will receive the test")
    parser.add_argument("--sender", default="postmaster@bohaus.in")
    args = parser.parse_args()

    message = EmailMessage()
    message["From"] = f"Bohaus Mail Test <{args.sender}>"
    message["To"] = args.recipient
    message["Subject"] = "Bohaus outbound mail authentication test"
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid(domain="bohaus.in")
    message.set_content(
        "Bohaus outbound email test\n\n"
        "This message was sent through the outbound-only Postfix/OpenDKIM "
        "service on Odysseus. Inspect the recipient's original message for "
        "SPF, DKIM and DMARC Authentication-Results.\n"
    )
    message.add_alternative(
        """<!doctype html>
<html lang="en">
  <body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
    <h1 style="font-size:20px">Bohaus outbound email test</h1>
    <p>This message was sent through the outbound-only Postfix/OpenDKIM
    service on Odysseus.</p>
    <p>Inspect the recipient's original message for SPF, DKIM and DMARC
    Authentication-Results.</p>
  </body>
</html>""",
        subtype="html",
    )

    with smtplib.SMTP("127.0.0.1", 1587, timeout=30) as smtp:
        smtp.send_message(message)
    print(f"Queued test message for {args.recipient}")


if __name__ == "__main__":
    main()
