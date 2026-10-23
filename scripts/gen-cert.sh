#!/bin/sh
# Tao thu muc neu chua co
mkdir -p nginx/certs

# Sinh chung chi SSL tu ky co thoi han 365 ngay
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/selfsigned.key \
  -out nginx/certs/selfsigned.crt \
  -subj "/C=VN/ST=Hanoi/L=Hanoi/O=TaskTracker/OU=IT/CN=localhost"

echo "Chung chi SSL tu ky da duoc tao thanh cong tai nginx/certs/"
