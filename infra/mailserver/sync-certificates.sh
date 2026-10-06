#!/bin/sh
set -eu
# Run as deploy (Docker access required). Copy only the mail certificate/key.
cd /home/deploy/mailserver
changed=$(docker run --rm -v /var/lib/caddy:/caddy:ro -v /home/deploy/mailserver/certs:/certs alpine:3.22 sh -ec '
source=$(find /caddy -type f -path "*/mail.bohaus.in/mail.bohaus.in.crt" | head -n 1)
test -n "$source"
key="${source%.crt}.key"
test -s "$key"
if ! cmp -s "$source" /certs/fullchain.pem; then
  umask 077
  cp "$key" /certs/privkey.pem.new
  cp "$source" /certs/fullchain.pem.new
  mv /certs/privkey.pem.new /certs/privkey.pem
  mv /certs/fullchain.pem.new /certs/fullchain.pem
  echo changed
fi
')
if [ "$changed" = changed ] && docker inspect bohaus-mailserver >/dev/null 2>&1; then
    docker restart bohaus-mailserver >/dev/null
fi
