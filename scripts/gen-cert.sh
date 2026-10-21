#!/bin/sh
# Sinh chung chi HTTPS tu ky (self-signed) cho Nginx
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/selfsigned.key -out nginx/certs/selfsigned.crt \
  -subj "/C=VN/ST=Thai Nguyen/O=TaskTracker/CN=localhost"
