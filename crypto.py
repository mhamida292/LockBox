import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

def derive_key(master_password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,
    )
    return kdf.derive(master_password.encode())

# ── Password-based (used for export/import backup files) ──────────────

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

# ── Key-based (used for entries — key is derived once at login) ────────

def encrypt_with_key(plaintext: str, key: bytes) -> str:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()

def decrypt_with_key(ciphertext_b64: str, key: bytes) -> str:
    raw = base64.b64decode(ciphertext_b64)
    nonce = raw[:12]
    ct = raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode()
