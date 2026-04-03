import os
import secrets
from datetime import timedelta
from flask import Flask
from database import init_db
from routes import bp

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(32))
app.permanent_session_lifetime = timedelta(minutes=30)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_PERMANENT'] = False

@app.after_request
def add_headers(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    return response

app.register_blueprint(bp)
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8743))
    app.run(host="0.0.0.0", port=port, debug=False)
