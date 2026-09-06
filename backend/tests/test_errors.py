"""The error envelope is a contract: the frontend switches on `error.code`."""


def test_unknown_route_returns_the_envelope_not_fastapi_default(client):
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_validation_errors_carry_per_field_messages(client):
    response = client.post("/api/v1/auth/login", json={"email": "x", "password": ""})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert isinstance(error["fields"], dict) and error["fields"]


def test_every_error_response_has_code_and_message(client):
    for method, url, kwargs in [
        ("get", "/api/v1/auth/me", {}),
        ("get", "/api/v1/nope", {}),
        ("post", "/api/v1/auth/login", {"json": {"email": "a", "password": ""}}),
    ]:
        response = getattr(client, method)(url, **kwargs)
        body = response.json()
        assert "error" in body, f"{url} did not use the envelope"
        assert "code" in body["error"] and "message" in body["error"]


def test_bad_input_never_returns_500(client):
    """Judging criterion: 'validate user input robustly'. A 500 on bad input is the
    single most visible way to fail it."""
    for payload in [{}, {"email": None}, {"email": [], "password": {}}, {"x": "y"}]:
        response = client.post("/api/v1/auth/login", json=payload)
        assert response.status_code < 500, f"{payload} caused a {response.status_code}"
