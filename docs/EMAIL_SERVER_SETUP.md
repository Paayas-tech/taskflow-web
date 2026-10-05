# Bohaus outbound email service

This document describes the outbound-only SMTP service on Odysseus
(`62.238.58.187`). It intentionally does not provide mailboxes, IMAP, POP3, or
public SMTP submission. It follows the minimal architecture described in
Miguel Grinberg's *How to Host your Own Email Server*: Postfix performs direct
MX delivery and OpenDKIM signs messages.

## Architecture and security boundary

- Host: `mail.bohaus.in`
- Sender domain: `bohaus.in`
- Runtime: `boky/postfix` with Postfix and OpenDKIM
- Local submission: `127.0.0.1:1587` only
- Remote delivery: direct MX delivery over outbound TCP 25
- No public inbound SMTP, submission, SMTPS, POP3, or IMAP listeners
- No SMTP authentication because the submission socket is not public
- Allowed envelope sender domain: `bohaus.in`
- Persistent DKIM directory: `/home/deploy/mailserver/dkim`
- Compose project: `/home/deploy/mailserver/docker-compose.yml`

The prior `docker-mailserver` configuration is retained as
`docker-compose.legacy-inbound.yml` for reference, but must not be started. It
published several mail ports publicly and is outside the outbound-only design.

## Required DNS records

Create these records at the authoritative DNS provider. DNS host/name fields
are shown relative to `bohaus.in`.

| Type | Host/name | Value | TTL |
| --- | --- | --- | --- |
| A | `mail` | `62.238.58.187` | 3600 |
| TXT | `@` | `v=spf1 ip4:62.238.58.187 -all` | 3600 |
| TXT | `mail` | `v=spf1 ip4:62.238.58.187 -all` | 3600 |
| TXT | `mail._domainkey` | See the DKIM value below | 3600 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100; rua=mailto:dmarc_rua@onsecureserver.net;` | 3600 |

DKIM record value (enter it as one continuous TXT value; DNS consoles may
split it into quoted chunks automatically):

```text
v=DKIM1; h=sha256; k=rsa; s=email; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy5IsZv1F52mv2BvJKaPbv7yViIjoD6SUU0Ob3De3CVtnRPQofPRuOnb6iXYRL8sjXfR4pZGSFwODa0bMeHWWoxgo/XHQ0nXTRaFV+CJGvkKVzuvVpZrWmHi0biP9mm0E15Q1A79gPoIpB6mA6xe3XfJMBcoDceMrNuu8H9wvlAMv38P3I7b4ZDyv1DCY2cr9B6+1p8XrtqPj4rHdFe8M5QpBhOblvXryuHAcBAbqeigdSX6d7b8Lhjx4uqLOgAyE3ZEuh16qKp4U7nNiAa38M5s7HDk6iCrqV1Oos4uYYtHH2BCzFFkdTq6I2fAay8gKlVycM6gDFJ+fKmkVBW26DwIDAQAB
```

Do not create an MX record merely for sending. MX controls inbound delivery
and is not required by this service. Preserve any existing MX records used by
the domain's forwarding or mailbox provider.

The SPF record on `mail.bohaus.in` authorizes the SMTP HELO identity in
addition to the root-domain record that authorizes the envelope sender. It is
recommended for consistent HELO/SPF checks even though aligned root-domain SPF,
DKIM and DMARC already pass.

### PTR / reverse DNS

PTR is configured in Hetzner Console, not in the `bohaus.in` DNS zone:

1. Open the Odysseus Cloud server.
2. Select **Networking**.
3. Edit reverse DNS for IPv4 `62.238.58.187`.
4. Set it to `mail.bohaus.in`.

The A record must resolve first. Afterwards these must agree:

```bash
dig +short A mail.bohaus.in @1.1.1.1
dig +short -x 62.238.58.187 @1.1.1.1
```

Expected output is `62.238.58.187` and `mail.bohaus.in.` respectively. This is
forward-confirmed reverse DNS (FCrDNS), which large mailbox providers expect.

### Existing senders warning

SPF permits only the Odysseus IP. If another legitimate provider also sends
mail for `bohaus.in`, merge its documented `include:` mechanism into the one
SPF record before publishing. A domain must not have multiple SPF records.

## Operations

```bash
cd /home/deploy/mailserver
docker compose ps
docker compose logs --tail=100 postfix
docker compose restart postfix
docker exec postfix postqueue -p
```

Check the effective security-sensitive settings:

```bash
docker exec postfix postconf \
  myhostname mydomain myorigin mydestination relayhost \
  smtp_tls_security_level smtp_tls_loglevel \
  smtpd_relay_restrictions smtpd_recipient_restrictions
```

Verify that only loopback submission is exposed:

```bash
ss -ltn | grep -E ':(25|465|587|993|1587) '
```

The only expected listener on the host is `127.0.0.1:1587`.

## DKIM key management

The private key is `/home/deploy/mailserver/dkim/bohaus.in.private`. Never
commit, paste, email, or copy it into documentation. The public DNS source is
`/home/deploy/mailserver/dkim/bohaus.in.txt`.

Back up the DKIM directory into encrypted storage. Restoring the same private
key avoids an unplanned DNS rotation. To rotate intentionally:

1. Choose a new selector such as `mail2027`.
2. Generate and persist a new 2048-bit key.
3. Publish the new selector's TXT record and wait for propagation.
4. Change `DKIM_SELECTOR` in Compose and recreate the container.
5. Confirm signed delivery before removing the old TXT record.

Never delete the persistent key directory while `DKIM_AUTOGENERATE` is active;
doing so creates a new key that will not match DNS.

## DNS and signing verification

Wait until all commands return the new records:

```bash
dig +short A mail.bohaus.in @1.1.1.1
dig +short TXT bohaus.in @1.1.1.1
dig +short TXT mail._domainkey.bohaus.in @1.1.1.1
dig +short TXT _dmarc.bohaus.in @1.1.1.1
dig +short -x 62.238.58.187 @1.1.1.1
```

Then validate the key from inside the container:

```bash
docker exec postfix opendkim-testkey -d bohaus.in -s mail -vvv
```

## Delivery test

Only test after A, PTR, SPF and DKIM resolve publicly. Send to a mailbox you
control (Gmail is useful because **Show original** displays authentication
results):

```bash
cd /home/deploy/mailserver
./send-test.py your-controlled-address@example.com
docker compose logs --since=5m postfix
```

In the received message's original source, confirm:

- `spf=pass` for `bohaus.in`
- `dkim=pass` with `header.d=bohaus.in` and `header.s=mail`
- `dmarc=pass` with `header.from=bohaus.in`
- the sending IP is `62.238.58.187`

If the message does not arrive, inspect `docker exec postfix postqueue -p` and
the logs. Do not repeatedly resend to major providers while DNS is incomplete.

## Application configuration

An application running directly on Odysseus can submit with:

```text
SMTP_HOST=127.0.0.1
SMTP_PORT=1587
SMTP_TLS=false
SMTP_USERNAME=
SMTP_PASSWORD=
MAIL_FROM=no-reply@bohaus.in
```

A Docker container cannot use its own `127.0.0.1` to reach the host. Prefer
joining the application and Postfix to an explicit private Docker network and
using `postfix:587`. Do not publish port 1587 on `0.0.0.0` as a shortcut.

TaskFlow uses the private `taskflow-mail` Docker network for this purpose. The
mailserver Compose project creates it and the TaskFlow Compose project joins it
as an external network. Start or recreate the mailserver before bringing up the
TaskFlow API:

```bash
docker compose -f /home/deploy/mailserver/docker-compose.yml up -d --force-recreate postfix
docker compose -f /home/deploy/taskflow/docker-compose.yml up -d --build --force-recreate api
```

The API environment should contain:

```text
SMTP_HOST=postfix
SMTP_PORT=587
SMTP_START_TLS=false
SMTP_TIMEOUT_SECONDS=10
EMAIL_FROM=TaskFlow <noreply@bohaus.in>
PUBLIC_APP_URL=https://taskflow.bohaus.in
EMAIL_UNSUBSCRIBE_URL=https://taskflow.bohaus.in/settings
```

## Maintenance checklist

- Review mail logs and queue weekly.
- Review DMARC aggregate reports weekly.
- Keep the container image patched and recreate it during a maintenance window.
- Monitor blocklists and provider reputation during IP warm-up.
- Start with low, expected transactional volume; do not send bulk campaigns.
- Confirm the host listener remains loopback-only after changes.
- Keep encrypted backups of the DKIM private key.

## References

- Miguel Grinberg, *How to Host your Own Email Server*: https://blog.miguelgrinberg.com/post/how-to-host-your-own-email-server
- Hetzner Cloud rDNS: https://docs.hetzner.com/cloud/servers/cloud-server-rdns/
- Postfix container: https://github.com/bokysan/docker-postfix
