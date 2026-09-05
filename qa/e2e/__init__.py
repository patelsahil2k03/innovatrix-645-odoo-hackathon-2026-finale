"""Playwright E2E smoke suite for the Account module's create ("Add") flows.

Not part of the backend pytest suite (docs/07_TESTING_AND_REVIEW.md) — this drives
the real browser against the real frontend + backend, the way a person actually
uses the app. Keep backend unit/integration tests for business-rule coverage;
keep this for "does the button someone clicks in the demo still work end to end."
"""
