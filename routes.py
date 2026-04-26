import json
import os
import string
import secrets
import sqlite3
import csv
import io
from time import time
from datetime import datetime
from functools import wraps

from flask import Blueprint, render_template, request, jsonify, session, make_response
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from database import get_db
from crypto import encrypt_data, decrypt_data, encrypt_with_key, decrypt_with_key, derive_key

bp = Blueprint('main', __name__)
ph = PasswordHasher()

# ── Rate limiting ─────────────────────────────────────────────────────

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60
_failed_attempts = {}

def check_rate_limit(ip):
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

def get_entry_key():
    """Get the cached AES key from session (derived once at login)."""
    import base64
    return base64.b64decode(session["entry_key"])

def setup_entry_key(master, conn):
    """Derive the entry key from master password using a fixed salt, cache in session.
    Also migrates old per-salt entries to the new key-based format."""
    import base64 as b64
    row = conn.execute("SELECT value FROM config WHERE key='key_salt'").fetchone()
    if row:
        salt = b64.b64decode(row["value"])
    else:
        salt = os.urandom(16)
        conn.execute("INSERT INTO config (key, value) VALUES (?, ?)", ("key_salt", b64.b64encode(salt).decode()))
        conn.commit()
    key = derive_key(master, salt)
    session["entry_key"] = b64.b64encode(key).decode()
    # Migrate old entries (encrypted with per-entry salt) to new format
    if not row:
        entries = conn.execute("SELECT id, encrypted_data FROM entries").fetchall()
        for e in entries:
            try:
                plaintext = decrypt_data(e["encrypted_data"], master)
                new_encrypted = encrypt_with_key(plaintext, key)
                conn.execute("UPDATE entries SET encrypted_data=? WHERE id=?", (new_encrypted, e["id"]))
            except Exception:
                pass
        conn.commit()

# ── Routes ────────────────────────────────────────────────────────────

@bp.route("/")
def index():
    return render_template("index.html")

@bp.route("/manifest.json")
def manifest():
    return jsonify({
        "name": "Lockbox",
        "short_name": "Lockbox",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#07080a",
        "theme_color": "#07080a",
        "icons": [
            {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/static/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
            {"src": "/static/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
        ]
    })

@bp.route("/api/status")
def status():
    ip = request.remote_addr
    locked, remaining = check_rate_limit(ip)
    return jsonify({
        "setup_done": is_setup_done(),
        "authenticated": session.get("authenticated", False),
        "locked": locked,
        "locked_seconds": remaining
    })

@bp.route("/api/setup", methods=["POST"])
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
    session.permanent = False
    session["authenticated"] = True
    session["master"] = master
    setup_entry_key(master, conn)
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/login", methods=["POST"])
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
    conn = get_db()
    setup_entry_key(master, conn)
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})

# ── Folders ───────────────────────────────────────────────────────────

@bp.route("/api/folders")
@login_required
def list_folders():
    conn = get_db()
    rows = conn.execute("SELECT id, name, icon, color FROM folders ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@bp.route("/api/folders", methods=["POST"])
@login_required
def create_folder():
    name = request.json.get("name", "").strip()
    icon = request.json.get("icon", "key")
    color = request.json.get("color", "")
    if not name:
        return jsonify({"error": "Name required"}), 400
    conn = get_db()
    try:
        cur = conn.execute("INSERT INTO folders (name, icon, color) VALUES (?, ?, ?)", (name, icon, color))
        conn.commit()
        fid = cur.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Folder already exists"}), 409
    conn.close()
    return jsonify({"id": fid, "name": name, "icon": icon, "color": color})

@bp.route("/api/folders/<int:fid>", methods=["PUT"])
@login_required
def update_folder(fid):
    name = request.json.get("name", "").strip()
    icon = request.json.get("icon", "key")
    color = request.json.get("color", "")
    if not name:
        return jsonify({"error": "Name required"}), 400
    conn = get_db()
    try:
        conn.execute("UPDATE folders SET name=?, icon=?, color=? WHERE id=?", (name, icon, color, fid))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Folder name already exists"}), 409
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/folders/<int:fid>", methods=["DELETE"])
@login_required
def delete_folder(fid):
    conn = get_db()
    conn.execute("UPDATE entries SET folder_id=NULL WHERE folder_id=?", (fid,))
    conn.execute("DELETE FROM folders WHERE id=?", (fid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ── Entries ───────────────────────────────────────────────────────────

@bp.route("/api/entries")
@login_required
def list_entries():
    conn = get_db()
    rows = conn.execute("""
        SELECT e.id, e.type, e.title, e.encrypted_data, e.folder_id,
               e.created_at, e.updated_at, f.name as folder_name
        FROM entries e LEFT JOIN folders f ON e.folder_id = f.id
        WHERE e.deleted_at IS NULL
        ORDER BY e.updated_at DESC
    """).fetchall()
    conn.close()
    key = get_entry_key()
    results = []
    for r in rows:
        try:
            decrypted = json.loads(decrypt_with_key(r["encrypted_data"], key))
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

@bp.route("/api/entries", methods=["POST"])
@login_required
def create_entry():
    body = request.json
    entry_type = body.get("type", "login")
    title = body.get("title", "").strip()
    data = body.get("data", {})
    folder_id = body.get("folder_id")
    if not title:
        return jsonify({"error": "Title required"}), 400
    key = get_entry_key()
    encrypted = encrypt_with_key(json.dumps(data), key)
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO entries (type, title, encrypted_data, folder_id) VALUES (?, ?, ?, ?)",
        (entry_type, title, encrypted, folder_id)
    )
    conn.commit()
    eid = cur.lastrowid
    row = conn.execute("""
        SELECT e.id, e.type, e.title, e.folder_id, e.created_at, e.updated_at, f.name as folder_name
        FROM entries e LEFT JOIN folders f ON e.folder_id = f.id WHERE e.id=?
    """, (eid,)).fetchone()
    conn.close()
    return jsonify({"id": eid, "ok": True, "entry": {
        "id": row["id"], "type": row["type"], "title": row["title"],
        "data": data, "folder_id": row["folder_id"], "folder_name": row["folder_name"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }})

@bp.route("/api/entries/<int:eid>", methods=["PUT"])
@login_required
def update_entry(eid):
    body = request.json
    title = body.get("title", "").strip()
    data = body.get("data", {})
    folder_id = body.get("folder_id")
    if not title:
        return jsonify({"error": "Title required"}), 400
    key = get_entry_key()
    encrypted = encrypt_with_key(json.dumps(data), key)
    conn = get_db()
    conn.execute(
        "UPDATE entries SET title=?, encrypted_data=?, folder_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (title, encrypted, folder_id, eid)
    )
    conn.commit()
    row = conn.execute("""
        SELECT e.id, e.type, e.title, e.folder_id, e.created_at, e.updated_at, f.name as folder_name
        FROM entries e LEFT JOIN folders f ON e.folder_id = f.id WHERE e.id=?
    """, (eid,)).fetchone()
    conn.close()
    return jsonify({"ok": True, "entry": {
        "id": row["id"], "type": row["type"], "title": row["title"],
        "data": data, "folder_id": row["folder_id"], "folder_name": row["folder_name"],
        "created_at": row["created_at"], "updated_at": row["updated_at"],
    }})

@bp.route("/api/entries/<int:eid>", methods=["DELETE"])
@login_required
def delete_entry(eid):
    conn = get_db()
    conn.execute("UPDATE entries SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL", (eid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ── Trash ─────────────────────────────────────────────────────────────

@bp.route("/api/trash")
@login_required
def list_trash():
    conn = get_db()
    # Auto-purge entries deleted more than 30 days ago
    conn.execute("DELETE FROM entries WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')")
    conn.commit()
    rows = conn.execute("""
        SELECT e.id, e.type, e.title, e.encrypted_data, e.folder_id,
               e.created_at, e.updated_at, e.deleted_at, f.name as folder_name
        FROM entries e LEFT JOIN folders f ON e.folder_id = f.id
        WHERE e.deleted_at IS NOT NULL
        ORDER BY e.deleted_at DESC
    """).fetchall()
    conn.close()
    key = get_entry_key()
    results = []
    for r in rows:
        try:
            decrypted = json.loads(decrypt_with_key(r["encrypted_data"], key))
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
            "deleted_at": r["deleted_at"],
        })
    return jsonify(results)

@bp.route("/api/entries/<int:eid>/restore", methods=["POST"])
@login_required
def restore_entry(eid):
    conn = get_db()
    conn.execute("UPDATE entries SET deleted_at=NULL WHERE id=?", (eid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/entries/<int:eid>/permanent", methods=["DELETE"])
@login_required
def permanent_delete_entry(eid):
    conn = get_db()
    conn.execute("DELETE FROM entries WHERE id=? AND deleted_at IS NOT NULL", (eid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/trash/empty", methods=["POST"])
@login_required
def empty_trash():
    conn = get_db()
    conn.execute("DELETE FROM entries WHERE deleted_at IS NOT NULL")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ── Password generator ────────────────────────────────────────────────

@bp.route("/api/generate-password")
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
    for i in range(len(pw_list) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        pw_list[i], pw_list[j] = pw_list[j], pw_list[i]

    return jsonify({"password": "".join(pw_list)})

# ── Export ────────────────────────────────────────────────────────────

@bp.route("/api/export", methods=["POST"])
@login_required
def export_vault():
    body = request.json
    master = body.get("master_password", "")
    fmt = body.get("format", "encrypted")
    backup_pw = body.get("backup_password", "")

    # Verify master password
    conn = get_db()
    row = conn.execute("SELECT value FROM config WHERE key='master_hash'").fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not set up"}), 400
    try:
        ph.verify(row["value"], master)
    except VerifyMismatchError:
        conn.close()
        return jsonify({"error": "Wrong master password"}), 401

    # Fetch and decrypt all entries
    entries_rows = conn.execute("""
        SELECT e.id, e.type, e.title, e.encrypted_data, e.folder_id,
               e.created_at, e.updated_at, f.name as folder_name
        FROM entries e LEFT JOIN folders f ON e.folder_id = f.id
        ORDER BY e.title
    """).fetchall()
    folders_rows = conn.execute("SELECT id, name, icon, color FROM folders ORDER BY name").fetchall()
    conn.close()

    key = get_entry_key()
    entries_data = []
    for r in entries_rows:
        try:
            decrypted = json.loads(decrypt_with_key(r["encrypted_data"], key))
        except Exception:
            decrypted = {}
        entries_data.append({
            "type": r["type"],
            "title": r["title"],
            "data": decrypted,
            "folder_name": r["folder_name"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        })
    folders_data = [{"name": f["name"], "icon": f["icon"], "color": f["color"]} for f in folders_rows]

    date_str = datetime.now().strftime("%Y-%m-%d")

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["title", "type", "username", "password", "url", "notes", "folder_name"])
        for e in entries_data:
            writer.writerow([
                e["title"], e["type"],
                e["data"].get("username", ""), e["data"].get("password", ""),
                e["data"].get("url", ""), e["data"].get("notes", ""),
                e["folder_name"] or ""
            ])
        resp = make_response(output.getvalue())
        resp.headers["Content-Type"] = "text/csv"
        resp.headers["Content-Disposition"] = f"attachment; filename=lockbox-export-{date_str}.csv"
        return resp

    # Encrypted backup
    if not backup_pw or len(backup_pw) < 8:
        return jsonify({"error": "Backup password must be at least 8 characters"}), 400
    payload = json.dumps({
        "version": 1,
        "exported_at": datetime.now().isoformat(),
        "folders": folders_data,
        "entries": entries_data,
    })
    encrypted = encrypt_data(payload, backup_pw)
    resp = make_response(encrypted)
    resp.headers["Content-Type"] = "application/octet-stream"
    resp.headers["Content-Disposition"] = f"attachment; filename=lockbox-backup-{date_str}.enc"
    return resp

# ── Import ────────────────────────────────────────────────────────────

@bp.route("/api/import", methods=["POST"])
@login_required
def import_vault():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    filename = f.filename or ""
    content = f.read().decode("utf-8")

    if filename.endswith(".enc"):
        backup_pw = request.form.get("backup_password", "")
        if not backup_pw:
            return jsonify({"error": "Backup password required"}), 400
        try:
            decrypted = decrypt_data(content.strip(), backup_pw)
            data = json.loads(decrypted)
        except Exception:
            return jsonify({"error": "Decryption failed — wrong password or corrupted file"}), 400
        imp_folders = data.get("folders", [])
        imp_entries = data.get("entries", [])
    elif filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content))
        headers = reader.fieldnames or []
        imp_entries = []
        imp_folders = []
        folder_names_seen = set()
        for row in reader:
            # Detect format and normalize
            if "login_username" in headers:  # Bitwarden
                title = row.get("name", "")
                username = row.get("login_username", "")
                password = row.get("login_password", "")
                url = row.get("login_uri", "")
                notes = row.get("notes", "")
                folder_name = row.get("folder", "")
            elif "grouping" in headers:  # LastPass
                title = row.get("name", "")
                username = row.get("username", "")
                password = row.get("password", "")
                url = row.get("url", "")
                notes = row.get("extra", "")
                folder_name = row.get("grouping", "")
            else:  # Lockbox native or Chrome
                title = row.get("title") or row.get("name", "")
                username = row.get("username", "")
                password = row.get("password", "")
                url = row.get("url", "")
                notes = row.get("notes", "")
                folder_name = row.get("folder_name") or row.get("folder", "")
            if not title:
                continue
            entry_type = row.get("type", "login")
            if entry_type not in ("login", "note"):
                entry_type = "login"
            imp_entries.append({
                "type": entry_type,
                "title": title,
                "data": {"username": username, "password": password, "url": url, "notes": notes},
                "folder_name": folder_name,
            })
            if folder_name and folder_name not in folder_names_seen:
                folder_names_seen.add(folder_name)
                imp_folders.append({"name": folder_name, "icon": "key", "color": ""})
    else:
        return jsonify({"error": "Unsupported file format. Use .enc or .csv"}), 400

    # Create folders and build name→id map
    conn = get_db()
    existing = conn.execute("SELECT id, name FROM folders").fetchall()
    folder_map = {r["name"]: r["id"] for r in existing}
    new_folders = 0
    for fo in imp_folders:
        if fo["name"] not in folder_map:
            try:
                cur = conn.execute("INSERT INTO folders (name, icon, color) VALUES (?, ?, ?)",
                                   (fo["name"], fo.get("icon", "key"), fo.get("color", "")))
                conn.commit()
                folder_map[fo["name"]] = cur.lastrowid
                new_folders += 1
            except sqlite3.IntegrityError:
                pass

    # Import entries
    key = get_entry_key()
    imported = 0
    for e in imp_entries:
        folder_id = folder_map.get(e.get("folder_name")) if e.get("folder_name") else None
        encrypted = encrypt_with_key(json.dumps(e["data"]), key)
        conn.execute(
            "INSERT INTO entries (type, title, encrypted_data, folder_id) VALUES (?, ?, ?, ?)",
            (e["type"], e["title"], encrypted, folder_id)
        )
        imported += 1
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "imported_entries": imported, "imported_folders": new_folders})

# ── Clear all data ────────────────────────────────────────────────────

@bp.route("/api/clear-all", methods=["POST"])
@login_required
def clear_all():
    conn = get_db()
    conn.execute("DELETE FROM entries")
    conn.execute("DELETE FROM folders")
    conn.execute("DELETE FROM config")
    conn.commit()
    conn.close()
    conn = get_db()
    try:
        conn.execute("INSERT INTO folders (name) VALUES (?)", ("General",))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    conn.close()
    session.clear()
    return jsonify({"ok": True})
