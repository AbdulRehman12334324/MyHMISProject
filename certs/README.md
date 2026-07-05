# Local HTTPS Certificate

Place `localhost.pem` and `localhost-key.pem` in this folder before running
`npm run dev`. Vite auto-detects them (see `vite.config.js`).

Generate with mkcert (recommended):
```bash
mkcert -install
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1
```

Or OpenSSL:
```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/localhost-key.pem -out certs/localhost.pem \
  -days 365 -subj "/CN=localhost"
```

If you generated certs for the backend (`backendLocalHost.zip/certs/`), you
can reuse the same `localhost.pem`/`localhost-key.pem` files here — copy
them over rather than generating twice, so both ends trust the same cert.

This folder is `.gitignore`d — never commit private keys.
