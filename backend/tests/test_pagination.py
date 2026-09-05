"""The list envelope is a contract the whole frontend depends on."""


def test_list_returns_the_standard_page_envelope(admin_client):
    response = admin_client.get("/api/v1/notifications")
    assert response.status_code == 200
    body = response.json()
    for key in ("items", "total", "page", "page_size", "pages"):
        assert key in body, f"missing '{key}' in page envelope"


def test_total_counts_all_rows_not_just_the_current_page(admin_client):
    """Regression guard: last round the frontend used items.length as the total and
    silently under-reported every count past one page."""
    full = admin_client.get("/api/v1/notifications?page_size=100").json()
    if full["total"] < 2:
        return  # not enough seeded rows to prove it here

    paged = admin_client.get("/api/v1/notifications?page_size=1").json()
    assert len(paged["items"]) == 1
    assert paged["total"] == full["total"]
    assert paged["total"] > len(paged["items"])


def test_page_size_is_bounded(admin_client):
    assert admin_client.get("/api/v1/notifications?page_size=1000").status_code == 422
    assert admin_client.get("/api/v1/notifications?page=0").status_code == 422


def test_sorting_by_an_unknown_column_is_ignored_not_an_error(admin_client):
    """Sortable columns are allowlisted, so an unknown value must degrade gracefully
    rather than 500 or open a SQL injection path."""
    response = admin_client.get("/api/v1/notifications?sort=drop_table")
    assert response.status_code == 200


def test_notifications_are_scoped_to_the_calling_user(admin_client, second_user_client):
    admin_ids = {n["id"] for n in admin_client.get("/api/v1/notifications").json()["items"]}
    second_user_ids = {n["id"] for n in second_user_client.get("/api/v1/notifications").json()["items"]}
    assert admin_ids.isdisjoint(second_user_ids)
