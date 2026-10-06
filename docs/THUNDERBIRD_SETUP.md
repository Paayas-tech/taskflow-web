# Bohaus private mail

Webmail: https://mail.bohaus.in (Roundcube). Use the full mailbox email address
and mailbox password. TaskFlow application passwords are separate.

## Thunderbird

Choose Add Mail Account, enter your name, email and password, then Manual config.

| Setting | Incoming | Outgoing |
| --- | --- | --- |
| Protocol | IMAP | SMTP |
| Hostname | mail.bohaus.in | mail.bohaus.in |
| Port | 993 | 587 |
| Connection security | SSL/TLS | STARTTLS |
| Authentication | Normal password | Normal password |
| Username | Full email address | Full email address |

SMTP port 465 with SSL/TLS is also available. Never disable certificate checks.
Initial accounts: karthik@bohaus.in and admin@bohaus.in. Initial generated
credentials are stored only on Odysseus in
`/home/deploy/mailserver/mailbox-credentials.json` (mode 600); share them privately.

## Accounts and storage

On Odysseus, add or change a mailbox password with an interactive prompt:

```bash
docker exec -it bohaus-mailserver setup email add person@bohaus.in
docker exec -it bohaus-mailserver setup email update person@bohaus.in
docker exec bohaus-mailserver setup email list
```

Mailboxes, server state, logs and Roundcube settings use persistent Docker
volumes. Account hashes and the imported DKIM key live in
`/home/deploy/mailserver/config`; TLS certificates in `certs`. Back up volumes,
configuration and keys securely. Never use `docker compose down -v` on this stack.

## DNS and firewall

Domain admin must publish MX `bohaus.in` priority 10 -> `mail.bohaus.in`.
Keep A `mail.bohaus.in` -> `62.238.58.187`, PTR -> `mail.bohaus.in`, existing
SPF, DKIM selector `mail`, and DMARC. Add HELO SPF TXT on `mail`:
`v=spf1 ip4:62.238.58.187 -all`. Do not publish an AAAA until IPv6 mail is configured.
Allow inbound TCP 25, 465, 587, 993 and existing HTTPS ports in the Hetzner firewall.
MX publication and an external delivery test are required before claiming inbound
mail is fully operational.

## TLS maintenance

Caddy issues and renews the public certificate. `sync-certificates.sh` copies
only the mail certificate and private key to Dovecot/Postfix, restarting the mail
container only when the certificate changes. Run it hourly through deploy's
crontab; keep its error log monitored. Roundcube verifies TLS for IMAP and SMTP.

## TaskFlow compatibility

The existing loopback/private Docker `postfix` relay remains available to
TaskFlow at `postfix:587` and host scripts at `127.0.0.1:1587`. Public submission
uses the separate authenticated mailbox server. Both sign with the same existing
bohaus.in DKIM key. Public clients must authenticate; no Docker network is trusted
for unauthenticated public relay.

References: [Docker Mailserver configuration](https://docker-mailserver.github.io/docker-mailserver/latest/config/environment/)
and [Roundcube container configuration](https://github.com/roundcube/roundcubemail-docker).
