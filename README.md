# ⬡ Lockbox

A self-hosted password vault built for simplicity. One Docker container, one master password, AES-256 encryption.

## Web App Features

**Security**
- AES-256-GCM encryption on all entries
- Argon2 master password hashing
- PBKDF2 key derivation (600,000 iterations)
- Rate limiting (5 attempts, 15 min lockout)
- Auto-lock timeout (configurable: 15 min, 30 min, 1 hour, or never)

**Vault**
- Logins (username, password, URL) and secure notes
- Folders with customizable icons (20 options) and colors (9 swatches)
- Inline entry editing — no modals, edit entries right in the list
- Search and sort (Recent, Newest, A→Z, Z→A)
- Copy username / password to clipboard, open URL directly

**Password Tools**
- Built-in password generator (configurable length, character sets)
- Password strength indicator

**Import / Export**
- Export encrypted backup (.enc) or plain CSV
- Import from Lockbox, Bitwarden, Chrome, or LastPass

**UI**
- 8 themes — Midnight, Ember, Arctic, Moss, Sakura, Slate, Amethyst, Lavender
- Mobile-friendly with PWA support (home screen icon)
- Settings panel with clear-all-data option

## Browser Extension Features

Compatible with Chrome and Firefox (Manifest V2).

**Auto-fill**
- Detects login forms on any site and injects an inline fill button
- Single match fills immediately; multiple matches show a picker
- Fill from the popup directly into the active tab

**Save Prompts**
- Detects form submissions and offers to save new credentials
- Editable title field before saving
- Category (folder) selection on save
- Duplicate detection — won't prompt if credentials already exist

**Popup**
- Search your vault from any page
- Filter entries by folder/category tabs
- Copy username or password to clipboard
- 8 themes synced with your preference
- One-click link to open your vault
- Refresh and lock buttons

**Smart Matching**
- Matches saved entries to the current site by hostname
- Highlights matching entries at the top of the popup

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
- Browser extension (Chrome / Firefox, Manifest V2)
