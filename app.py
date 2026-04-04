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
    # CORS for browser extension
    origin = None
    from flask import request
    req_origin = request.headers.get('Origin', '')
    if req_origin.startswith('chrome-extension://') or req_origin.startswith('moz-extension://'):
        origin = req_origin
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

@app.before_request
def handle_preflight():
    from flask import request, make_response
    if request.method == 'OPTIONS':
        resp = make_response()
        origin = request.headers.get('Origin', '')
        if origin.startswith('chrome-extension://') or origin.startswith('moz-extension://'):
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Access-Control-Allow-Credentials'] = 'true'
            resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        return resp

app.register_blueprint(bp)
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8743))
    app.run(host="0.0.0.0", port=port, debug=False)
