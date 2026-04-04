# ⬡ Lockbox

A self-hosted password vault built for simplicity. One Docker container, one master password, AES-256 encryption.

## Features

- **AES-256-GCM** encryption on all entries (per-entry salt + nonce)
- **Argon2** master password hashing
- **PBKDF2** key derivation (600,000 iterations)
- Logins (username, password, URL) and secure notes
- Folders with customizable icons (20 options) and colors (9 swatches)
- Inline entry editing — no modals, edit entries right in the list
- Search and sort (Recent, Newest, A→Z, Z→A)
- Built-in password generator (configurable length, symbols)
- Password strength indicator
- Copy username / password to clipboard, open URL directly
- 8 themes — Midnight, Ember, Arctic, Moss, Sakura, Slate, Amethyst, Lavender
- Rate limiting (5 attempts, 15 min lockout)
- Auto-lock timeout (configurable: 15 min, 30 min, 1 hour, or never)
- Mobile-friendly with PWA support (home screen icon)
- Export encrypted backup (.enc) or plain CSV
- Import from Lockbox, Bitwarden, Chrome, or LastPass
- Settings panel with clear-all-data option

## Quick Start

```bash
git clone https://github.com/mhamida292/lockbox.git
cd lockbox
cp docker-compose.example.yml docker-compose.yml
```

Generate a secret key and update `docker-compose.yml`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Start it up:

```bash
docker compose up -d
```

Open `http://your-server-ip:8743` and set your master password.

## Security Notes

- All sensitive data is encrypted before it hits the database
- The master password is never stored — only an Argon2 hash
- Entry titles are stored in plaintext for search functionality
- Data lives in a Docker volume as a SQLite file (`vault.db`)
- **Recommended:** Run behind [Tailscale](https://tailscale.com) for encrypted transport

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | random | Flask session signing key — **change this** |
| `PORT` | `8743` | Port the app listens on |

## Backup

**In-app:** Settings → Export Backup creates an AES-256 encrypted `.enc` file protected with a backup password you choose. Restore it via Settings → Import.

**Manual:** Your vault is a single SQLite file inside the Docker volume:

```bash
docker cp lockbox:/data/vault.db ./vault-backup.db
```

Without your master password, the backup is useless to anyone else.

## Tech Stack

- Python / Flask / Gunicorn
- SQLite
- Argon2 + AES-256-GCM + PBKDF2
- Vanilla JS frontend

## License

MIT
