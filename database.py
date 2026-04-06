import os
import sqlite3

DB_PATH = "/data/vault.db"

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
    # Migrate: add icon column if it doesn't exist
    try:
        conn.execute("ALTER TABLE folders ADD COLUMN icon TEXT NOT NULL DEFAULT 'key'")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists
    # Migrate: add color column if it doesn't exist
    try:
        conn.execute("ALTER TABLE folders ADD COLUMN color TEXT NOT NULL DEFAULT ''")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists
    # Migrate: add deleted_at column for trash/recycle bin
    try:
        conn.execute("ALTER TABLE entries ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        conn.execute("INSERT INTO folders (name) VALUES (?)", ("General",))
        conn.commit()
    except sqlite3.IntegrityError:
        pass
    conn.close()
