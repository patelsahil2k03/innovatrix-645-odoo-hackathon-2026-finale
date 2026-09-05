"""Auth is the one thing every problem statement needs. It must be airtight."""

from app.core.settings import get_settings

settings = get_settings()
LOGIN = "/api/v1/auth/login"


def test_login_succeeds_and_sets_an_httponly_cookie(client):
    response = client.post(
        LOGIN, json={"email": "admin@urbanfurniture.in", "password": settings.seed_password}
    )
    assert response.status_code == 200
    assert response.json()["role"]["name"] == "Admin"

    cookie_header = response.headers.get("set-cookie", "")
    # httpOnly is what stops an XSS bug from stealing the session.
    assert "httponly" in cookie_header.lower()


def test_login_is_case_insensitive_on_email(client):
    response = client.post(
        LOGIN, json={"email": "ADMIN@urbanfurniture.in", "password": settings.seed_password}
    )
    assert response.status_code == 200


def test_wrong_password_is_rejected_with_the_error_envelope(client):
    response = client.post(LOGIN, json={"email": "admin@urbanfurniture.in", "password": "wrong"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_unknown_email_gives_the_same_error_as_a_wrong_password(client):
    """Different messages here would let an attacker enumerate valid accounts."""
    unknown = client.post(LOGIN, json={"email": "nobody@demo.in", "password": "x"})
    wrong = client.post(LOGIN, json={"email": "admin@urbanfurniture.in", "password": "x"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["code"] == wrong.json()["error"]["code"]


def test_malformed_email_returns_a_field_level_validation_error(client):
    response = client.post(LOGIN, json={"email": "not-an-email", "password": "x"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    # Field keys must match the request body exactly so the UI can map them to inputs.
    assert "email" in error["fields"]


def test_protected_route_rejects_an_anonymous_request(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_returns_the_signed_in_user(admin_client):
    response = admin_client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "admin@urbanfurniture.in"


def test_bearer_token_also_works_for_curl_and_swagger(client):
    token = client.post(
        "/api/v1/auth/token",
        data={"username": "admin@urbanfurniture.in", "password": settings.seed_password},
    ).json()["access_token"]

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200


def test_a_garbage_token_is_rejected_not_crashed(client):
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.real.token"}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_logout_clears_the_session(admin_client):
    assert admin_client.post("/api/v1/auth/logout").status_code == 200
    assert admin_client.get("/api/v1/auth/me").status_code == 401
