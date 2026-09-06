"""Auth is the one thing every problem statement needs. It must be airtight."""

import pytest

from app.core.settings import get_settings

settings = get_settings()
LOGIN = "/api/v1/auth/login"
API = "/api/v1"


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


def test_audit_log_names_the_actor_rather_than_its_id(admin_client):
    """A screen showing UUIDs answers "who" with something nobody can read."""
    response = admin_client.get(f"{API}/audit-logs", params={"page_size": 1})
    assert response.status_code == 200, response.text
    rows = response.json()["items"]
    if not rows:
        pytest.skip("no audit rows in this database")

    row = rows[0]
    assert row["user_name"], "the acting user's name has to come back with the row"
    assert "@" in (row["user_email"] or "")
    # created_at was typed `object`, so the contract advertised an untyped blob.
    assert row["created_at"].startswith("20")


def test_audit_log_records_refusals_not_only_successes(admin_client, second_user_client):
    """An Accountant modifying master data is a 403 by rule, and that refusal
    is precisely the row an audit trail is consulted for. Only 2xx used to be
    kept, which left the outcome column unable to say anything but accepted."""
    contact = second_user_client.get(f"{API}/contacts", params={"page_size": 1}).json()["items"][0]

    refused = second_user_client.patch(f"{API}/contacts/{contact['id']}", json={"name": "Nope"})
    assert refused.status_code == 403

    rejected = admin_client.get(
        f"{API}/audit-logs", params={"outcome": "rejected", "page_size": 50}
    ).json()
    assert any(
        row["entity_id"] == contact["id"] and row["status_code"] == 403
        for row in rejected["items"]
    ), "the refused write should be in the log"

    accepted = admin_client.get(
        f"{API}/audit-logs", params={"outcome": "accepted", "page_size": 1}
    ).json()
    assert accepted["total"] > 0
    assert accepted["total"] + rejected["total"] == admin_client.get(
        f"{API}/audit-logs", params={"page_size": 1}
    ).json()["total"]


def test_audit_log_entities_lists_only_what_has_rows(admin_client):
    """The filter must not offer a module that returns nothing."""
    entities = admin_client.get(f"{API}/audit-logs/entities").json()
    assert isinstance(entities, list)
    for name in entities:
        total = admin_client.get(
            f"{API}/audit-logs", params={"entity_name": name, "page_size": 1}
        ).json()["total"]
        assert total > 0, f"{name} is offered as a filter but matches nothing"
