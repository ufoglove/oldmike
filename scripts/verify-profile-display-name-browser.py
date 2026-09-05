import datetime
import http.client
import http.server
import os
import ssl
import tempfile
import threading
from urllib.parse import urlparse

from axe_playwright_python.sync_playwright import Axe
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from playwright.sync_api import expect, sync_playwright

base_url = os.environ.get("PROFILE_E2E_BASE_URL", "")
backend_url = os.environ.get("PROFILE_E2E_BACKEND_URL", "")
email = os.environ.get("PROFILE_E2E_EMAIL", "")
password = os.environ.get("PROFILE_E2E_PASSWORD", "")
chrome = os.environ.get("PROFILE_E2E_CHROME", "")
if not all((base_url, backend_url, email, password, chrome)):
    raise SystemExit(2)

public_origin = urlparse(base_url)
backend_origin = urlparse(backend_url)
if public_origin.scheme != "https" or public_origin.hostname != "localhost" or not public_origin.port:
    raise SystemExit(2)
if backend_origin.scheme != "http" or backend_origin.hostname != "127.0.0.1" or not backend_origin.port:
    raise SystemExit(2)

forbidden = ("OpenClaw", "Codex", "Old Mike", "Better Auth", "OpenAI", "ChatGPT", "Anthropic", "Claude", "Gemini")
updated_name = "林研究者"
axe = Axe()


def assert_public_branding(page):
    html = page.content()
    for value in forbidden:
        assert value not in html


def assert_axe(page):
    result = axe.run(page)
    failures = [
        (item.get("id", "unknown"), [node.get("target", []) for node in item.get("nodes", [])])
        for item in result.response.get("violations", [])
    ]
    assert result.violations_count == 0, failures


class LocalHttpsProxy(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _proxy(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(content_length) if content_length else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"connection", "host", "proxy-connection", "transfer-encoding"}
        }
        headers["Host"] = public_origin.netloc
        headers["X-Forwarded-Host"] = public_origin.netloc
        headers["X-Forwarded-Proto"] = "https"
        connection = http.client.HTTPConnection(backend_origin.hostname, backend_origin.port, timeout=15)
        try:
            connection.request(self.command, self.path, body=body, headers=headers)
            upstream = connection.getresponse()
            response_body = upstream.read()
            self.send_response(upstream.status)
            for key, value in upstream.getheaders():
                if key.lower() not in {"connection", "content-length", "transfer-encoding"}:
                    self.send_header(key, value)
            self.send_header("Content-Length", str(len(response_body)))
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(response_body)
        finally:
            connection.close()

    do_DELETE = _proxy
    do_GET = _proxy
    do_HEAD = _proxy
    do_OPTIONS = _proxy
    do_PATCH = _proxy
    do_POST = _proxy
    do_PUT = _proxy

    def log_message(self, _format, *_args):
        return


def generate_ephemeral_certificate(directory):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=1))
        .not_valid_after(now + datetime.timedelta(hours=1))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
        .sign(key, hashes.SHA256())
    )
    cert_path = os.path.join(directory, "localhost-cert.pem")
    key_path = os.path.join(directory, "localhost-key.pem")
    with open(cert_path, "wb") as cert_file:
        cert_file.write(certificate.public_bytes(serialization.Encoding.PEM))
    with open(key_path, "wb") as key_file:
        key_file.write(
            key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
    os.chmod(cert_path, 0o600)
    os.chmod(key_path, 0o600)
    return cert_path, key_path


with tempfile.TemporaryDirectory(prefix="oldmike-v1518-https-") as certificate_directory:
    cert_path, key_path = generate_ephemeral_certificate(certificate_directory)
    proxy = http.server.ThreadingHTTPServer(("127.0.0.1", public_origin.port), LocalHttpsProxy)
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    tls.load_cert_chain(certfile=cert_path, keyfile=key_path)
    proxy.socket = tls.wrap_socket(proxy.socket, server_side=True)
    proxy_thread = threading.Thread(target=proxy.serve_forever, daemon=True)
    proxy_thread.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=chrome, headless=True)
            context = browser.new_context(locale="zh-TW", ignore_https_errors=True)
            page = context.new_page()
            page.goto(f"{base_url}/login", wait_until="networkidle")
            expect(page.get_by_role("heading", name="老麥科研工作台")).to_be_visible()
            assert_public_branding(page)
            assert_axe(page)

            login_statuses = []
            page.on("response", lambda response: login_statuses.append(response.status) if "/api/auth/sign-in/email" in response.url else None)
            page.get_by_label("Email", exact=True).fill(email)
            page.get_by_label("密碼", exact=True).fill(password)
            page.get_by_role("button", name="登入研究工作台").click()
            page.wait_for_timeout(1000)
            assert login_statuses == [200], f"LOGIN_HTTP_STATUS={login_statuses[-1] if login_statuses else 'NOT_OBSERVED'}"
            session_cookies = [cookie for cookie in context.cookies(base_url) if cookie["name"].endswith("session_token")]
            assert len(session_cookies) == 1, f"SESSION_COOKIE_COUNT={len(session_cookies)}"
            assert session_cookies[0]["secure"] is True, "SESSION_COOKIE_SECURE=FAIL"
            account_status = page.evaluate("async () => (await fetch('/api/account/status')).status")
            assert account_status == 200, f"AUTHENTICATED_ACCOUNT_STATUS_HTTP={account_status}"
            page.goto(f"{base_url}/", wait_until="networkidle")
            expect(page).to_have_url(f"{base_url}/")
            expect(page.get_by_test_id("sidebar-display-name")).to_have_text("Fixture Researcher")
            assert_public_branding(page)

            page.goto(f"{base_url}/account", wait_until="networkidle")
            profile_statuses = []
            page.on("response", lambda response: profile_statuses.append(response.status) if "/api/account/profile" in response.url else None)
            field = page.get_by_label("自訂顯示名稱", exact=True)
            expect(field).to_have_value("Fixture Researcher")
            paste_allowed = field.evaluate("node => node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))")
            assert paste_allowed is True

            field.fill(" 前後空白")
            page.get_by_role("button", name="儲存顯示名稱").click()
            expect(page.locator("#display-name-error")).to_contain_text("前後不可含空白")
            expect(field).to_have_attribute("aria-invalid", "true")

            field.fill(updated_name)
            page.get_by_role("button", name="儲存顯示名稱").click()
            expect(page.locator(".profile-message.success")).to_contain_text("顯示名稱已更新")
            assert profile_statuses[-1] == 200, f"PROFILE_UPDATE_HTTP={profile_statuses[-1] if profile_statuses else 'NOT_OBSERVED'}"
            expect(field).to_have_value(updated_name)
            assert_axe(page)

            direct_status = page.evaluate("""async () => (await fetch('/api/auth/update-user', {
              method: 'POST', headers: {'Content-Type': 'application/json', Origin: location.origin}, body: JSON.stringify({name: 'blocked'})
            })).status""")
            assert direct_status == 404

            page.goto(f"{base_url}/", wait_until="networkidle")
            expect(page.get_by_test_id("sidebar-display-name")).to_have_text(updated_name)
            assert_public_branding(page)
            assert_axe(page)

            page.goto(f"{base_url}/account", wait_until="networkidle")
            expect(page.get_by_label("自訂顯示名稱", exact=True)).to_have_value(updated_name)
            assert_public_branding(page)

            anonymous = browser.new_context(locale="zh-TW", ignore_https_errors=True)
            anonymous_page = anonymous.new_page()
            anonymous_page.goto(f"{base_url}/login", wait_until="networkidle")
            status = anonymous_page.evaluate("""async () => (await fetch('/api/account/profile', {
              method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({displayName: 'blocked'})
            })).status""")
            assert status == 401
            anonymous.close()
            context.close()
            browser.close()
    finally:
        proxy.shutdown()
        proxy.server_close()
        proxy_thread.join(timeout=5)

print("PROFILE_BROWSER_E2E=PASS")
print("PROFILE_SESSION_REFRESH_E2E=PASS")
print("PROFILE_AUTHORIZATION_E2E=PASS")
print("PROFILE_ACCESSIBILITY_AXE=PASS")
print("PROFILE_PASTE_CONTRACT=PASS")
print("PUBLIC_SSR_BRANDING_SCAN=PASS")
