"""Run once on Odysseus. Secrets stay in a mode-600 file on that server."""
import json
import os
import secrets
import subprocess
from pathlib import Path

root = Path('/home/deploy/mailserver')
os.umask(0o077)
credentials_path = root / 'mailbox-credentials.json'
credentials = json.loads(credentials_path.read_text()) if credentials_path.exists() else {}
accounts_path = root / 'config/postfix-accounts.cf'
existing = accounts_path.read_text() if accounts_path.exists() else ''
for address in ['karthik@bohaus.in', 'admin@bohaus.in']:
    if any(line.startswith(address + '|') for line in existing.splitlines()):
        continue
    password = secrets.token_urlsafe(24)
    password_hash = subprocess.check_output([
        'docker', 'run', '--rm', '--entrypoint', 'doveadm',
        'ghcr.io/docker-mailserver/docker-mailserver:16.0.1',
        'pw', '-s', 'SHA512-CRYPT', '-p', password,
    ], text=True).strip()
    existing += address + '|' + password_hash + '\n'
    credentials[address] = password
accounts_path.write_text(existing)
credentials_path.write_text(json.dumps(credentials, indent=2) + '\n')
credentials_path.chmod(0o600)
(root / 'config/postfix-virtual.cf').write_text(
    'postmaster@bohaus.in admin@bohaus.in\n'
    'abuse@bohaus.in admin@bohaus.in\n'
    'noreply@bohaus.in admin@bohaus.in\n'
)
(root / 'config/opendkim/KeyTable').write_text(
    'mail._domainkey.bohaus.in bohaus.in:mail:/etc/opendkim/keys/bohaus.in/mail.private\n'
)
(root / 'config/opendkim/SigningTable').write_text(
    '*@bohaus.in mail._domainkey.bohaus.in\n'
)
(root / 'config/opendkim/TrustedHosts').write_text('127.0.0.1\nlocalhost\n')
roundcube_key = root / 'roundcube/local.inc.php'
if not roundcube_key.exists():
    roundcube_key.write_text(
        '<?php\n$config["des_key"] = "' + secrets.token_hex(12) + '";\n'
        '$config["force_https"] = true;\n'
        '$config["use_https"] = true;\n'
        '$config["imap_conn_options"] = ["ssl" => ["verify_peer" => true, "verify_peer_name" => true]];\n'
        '$config["smtp_conn_options"] = ["ssl" => ["verify_peer" => true, "verify_peer_name" => true]];\n'
    )
    roundcube_key.chmod(0o644)
print('Mailbox accounts provisioned. Credentials saved securely at', credentials_path)
