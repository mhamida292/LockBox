import os
import json
import base64
import secrets
import hashlib
import sqlite3
import string
from datetime import timedelta
from functools import wraps
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from flask import (
    Flask, render_template, request, jsonify, session, redirect, url_for
)
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.permanent_session_lifetime = timedelta(minutes=30)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_PERMANENT'] = False

DB_PATH = "/data/vault.db"
ph = PasswordHasher()

# ── Rate limiting ─────────────────────────────────────────────────────
from time import time

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60  # 15 minutes
_failed_attempts = {}  # ip -> {"count": int, "locked_until": float}

def check_rate_limit(ip):
    """Returns (is_locked, seconds_remaining)"""
    entry = _failed_attempts.get(ip)
    if not entry:
        return False, 0
    if entry.get("locked_until") and time() < entry["locked_until"]:
        remaining = int(entry["locked_until"] - time())
        return True, remaining
    if entry.get("locked_until") and time() >= entry["locked_until"]:
        del _failed_attempts[ip]
        return False, 0
    return False, 0

def record_failed_attempt(ip):
    entry = _failed_attempts.get(ip, {"count": 0})
    entry["count"] = entry.get("count", 0) + 1
    if entry["count"] >= MAX_ATTEMPTS:
        entry["locked_until"] = time() + LOCKOUT_SECONDS
    _failed_attempts[ip] = entry

def clear_failed_attempts(ip):
    _failed_attempts.pop(ip, None)

@app.after_request
def add_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    return response

# ── Database ──────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL DEFAULT 'login',
            title TEXT NOT NULL,
            encrypted_data TEXT NOT NULL,
            folder_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        );
    """)
    # Insert default folder
    try:
        conn.execute("INSERT INTO folders (name) VALUES (?)", ("General",))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    conn.close()

init_db()

# ── Encryption helpers ────────────────────────────────────────────────

def derive_key(master_password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,
    )
    return kdf.derive(master_password.encode())

def encrypt_data(plaintext: str, master_password: str) -> str:
    salt = os.urandom(16)
    key = derive_key(master_password, salt)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
    payload = salt + nonce + ct
    return base64.b64encode(payload).decode()

def decrypt_data(ciphertext_b64: str, master_password: str) -> str:
    raw = base64.b64decode(ciphertext_b64)
    salt = raw[:16]
    nonce = raw[16:28]
    ct = raw[28:]
    key = derive_key(master_password, salt)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode()

# ── Auth ──────────────────────────────────────────────────────────────

def is_setup_done():
    conn = get_db()
    row = conn.execute("SELECT value FROM config WHERE key='master_hash'").fetchone()
    conn.close()
    return row is not None

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "authenticated" not in session:
            return jsonify({"error": "unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

# ── Routes ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/manifest.json")
def manifest():
    return jsonify({
        "name": "Lockbox",
        "short_name": "Lockbox",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#07080a",
        "theme_color": "#07080a",
        "icons": [
            {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png"}
        ]
    })

@app.route("/api/status")
def status():
    ip = request.remote_addr
    locked, remaining = check_rate_limit(ip)
    return jsonify({
        "setup_done": is_setup_done(),
        "authenticated": session.get("authenticated", False),
        "locked": locked,
        "locked_seconds": remaining
    })

@app.route("/api/setup", methods=["POST"])
def setup():
    if is_setup_done():
        return jsonify({"error": "Already set up"}), 400
    data = request.json
    master = data.get("master_password", "")
    if len(master) < 8:
        return jsonify({"error": "Master password must be at least 8 characters"}), 400
    hashed = ph.hash(master)
    conn = get_db()
    conn.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("master_hash", hashed))
    conn.commit()
    conn.close()
    session.permanent = False
    session["authenticated"] = True
    session["master"] = master
    return jsonify({"ok": True})

@app.route("/api/login", methods=["POST"])
def login():
    ip = request.remote_addr
    locked, remaining = check_rate_limit(ip)
    if locked:
        mins = remaining // 60
        return jsonify({"error": f"Too many attempts. Locked for {mins}m {remaining % 60}s"}), 429
    data = request.json
    master = data.get("master_password", "")
    conn = get_db()
    row = conn.execute("SELECT value FROM config WHERE key='master_hash'").fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Not set up"}), 400
    try:
        ph.verify(row["value"], master)
    except VerifyMismatchError:
        record_failed_attempt(ip)
        entry = _failed_attempts.get(ip, {})
        count = entry.get("count", 0)
        if count >= MAX_ATTEMPTS:
            return jsonify({"error": "Too many attempts. Locked for 15 minutes"}), 429
        left = MAX_ATTEMPTS - count
        return jsonify({"error": f"Wrong password. {left} attempt{'s' if left != 1 else ''} remaining"}), 401
    clear_failed_attempts(ip)
    session.permanent = False
    session["authenticated"] = True
    session["master"] = master
    return jsonify({"ok": True})

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})

# ── Folders ───────────────────────────────────────────────────────────

@app.route("/api/folders")
@login_required
def list_folders():
    conn = get_db()
    rows = conn.execute("SELECT id, name FROM folders ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/folders", methods=["POST"])
@login_required
def create_folder():
    name = request.json.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    conn = get_db()
    try:
        cur = conn.execute("INSERT INTO folders (name) VALUES (?)", (name,))
        conn.commit()
        fid = cur.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Folder already exists"}), 409
    conn.close()
    return jsonify({"id": fid, "name": name})

@app.route("/api/folders/<int:fid>", methods=["DELETE"])
@login_required
def delete_folder(fid):
    conn = get_db()
    conn.execute("UPDATE entries SET folder_id=NULL WHERE folder_id=?", (fid,))
    conn.execute("DELETE FROM folders WHERE id=?", (fid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ── Entries ───────────────────────────────────────────────────────────

@app.route("/api/entries")
@login_required
def list_entries():
    conn = get_db()
    rows = conn.execute("""
        SELECT e.id, e.type, e.title, e.encrypted_data, e.folder_id, 
               e.created_at, e.updated_at, f.name as folder_name
        FROM entries e LEFT JOIN folders f ON e.folder_id = f.id
        ORDER BY e.updated_at DESC
    """).fetchall()
    conn.close()
    master = session.get("master")
    results = []
    for r in rows:
        try:
            decrypted = json.loads(decrypt_data(r["encrypted_data"], master))
        except Exception:
            decrypted = {}
        results.append({
            "id": r["id"],
            "type": r["type"],
            "title": r["title"],
            "data": decrypted,
            "folder_id": r["folder_id"],
            "folder_name": r["folder_name"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        })
    return jsonify(results)

@app.route("/api/entries", methods=["POST"])
@login_required
def create_entry():
    body = request.json
    entry_type = body.get("type", "login")
    title = body.get("title", "").strip()
    data = body.get("data", {})
    folder_id = body.get("folder_id")
    if not title:
        return jsonify({"error": "Title required"}), 400
    master = session.get("master")
    encrypted = encrypt_data(json.dumps(data), master)
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO entries (type, title, encrypted_data, folder_id) VALUES (?, ?, ?, ?)",
        (entry_type, title, encrypted, folder_id)
    )
    conn.commit()
    eid = cur.lastrowid
    conn.close()
    return jsonify({"id": eid, "ok": True})

@app.route("/api/entries/<int:eid>", methods=["PUT"])
@login_required
def update_entry(eid):
    body = request.json
    title = body.get("title", "").strip()
    data = body.get("data", {})
    folder_id = body.get("folder_id")
    if not title:
        return jsonify({"error": "Title required"}), 400
    master = session.get("master")
    encrypted = encrypt_data(json.dumps(data), master)
    conn = get_db()
    conn.execute(
        "UPDATE entries SET title=?, encrypted_data=?, folder_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (title, encrypted, folder_id, eid)
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/entries/<int:eid>", methods=["DELETE"])
@login_required
def delete_entry(eid):
    conn = get_db()
    conn.execute("DELETE FROM entries WHERE id=?", (eid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ── Password generator ────────────────────────────────────────────────

@app.route("/api/generate-password")
@login_required
def generate_password():
    length = min(max(int(request.args.get("length", 20)), 8), 128)
    use_upper = request.args.get("uppercase", "true") == "true"
    use_digits = request.args.get("digits", "true") == "true"
    use_symbols = request.args.get("symbols", "true") == "true"
    
    chars = string.ascii_lowercase
    required = [secrets.choice(string.ascii_lowercase)]
    if use_upper:
        chars += string.ascii_uppercase
        required.append(secrets.choice(string.ascii_uppercase))
    if use_digits:
        chars += string.digits
        required.append(secrets.choice(string.digits))
    if use_symbols:
        syms = "!@#$%^&*()-_=+[]{}|;:,.<>?"
        chars += syms
        required.append(secrets.choice(syms))
    
    remaining = length - len(required)
    pw_list = required + [secrets.choice(chars) for _ in range(remaining)]
    # Shuffle
    for i in range(len(pw_list) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        pw_list[i], pw_list[j] = pw_list[j], pw_list[i]
    
    return jsonify({"password": "".join(pw_list)})

# ── Clear all data ────────────────────────────────────────────────────

@app.route("/api/clear-all", methods=["POST"])
@login_required
def clear_all():
    conn = get_db()
    conn.execute("DELETE FROM entries")
    conn.execute("DELETE FROM folders")
    conn.execute("DELETE FROM config")
    conn.commit()
    conn.close()
    # Re-create default folder
    conn = get_db()
    try:
        conn.execute("INSERT INTO folders (name) VALUES (?)", ("General",))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    conn.close()
    session.clear()
    return jsonify({"ok": True})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8743))
    app.run(host="0.0.0.0", port=port, debug=False)