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
- Trash / recycle bin — restore deleted entries, auto-purge after 30 days
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
- Multi-step login support (e.g. Google — fills email on step 1, password on step 2)

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

## Installing the Firefox Extension

A pre-signed `.xpi` is included in `extension/web-ext-artifacts/` and can be installed directly on regular Firefox — no Developer Edition needed.

1. Open Firefox and go to `about:addons`
2. Click the gear icon → **Install Add-on From File**
3. Select the `.xpi` file from `extension/web-ext-artifacts/`
4. Click **Add** when prompted

Once installed, click the Lockbox icon in your toolbar, enter your server URL and master password to connect.

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

## Roadmap

1. ~~**Entry modal in extension** — view and edit logins (username, password, URL) and notes directly from the popup without opening the vault~~ ✓
2. **WebAuthn biometric login** — Face ID / fingerprint login for the web app
3. ~~**Fix extension bugs** — padlock icon appearing randomly and in wrong positions on some pages~~ ✓
4. ~~**Multi-step login form support** — handle sites like Google where email and password are on separate screens~~ ✓
5. ~~**Increase extension UI scale** — larger fonts and better readability in the popup~~ ✓
6. **Drag and drop category reordering** — reorder folders/categories in the web app
7. ~~**Trash/recycle bin** — recover deleted entries, auto-empty after 30 days~~ ✓
8. ~~**Replace entry action icons** — refresh the copy/fill button icons in the extension popup~~ ✓

## Tech Stack

- Python / Flask / Gunicorn
- SQLite
- Argon2 + AES-256-GCM + PBKDF2
- Vanilla JS frontend
- Browser extension (Chrome / Firefox, Manifest V2)
