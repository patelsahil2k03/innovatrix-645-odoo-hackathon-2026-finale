"""Single error envelope. Already-built boilerplate per docs/02_ARCHITECTURE.md —
reproduced here only so the domain test suite has a stable type to import against."""


class AppError(Exception):
    def __init__(self, code: str, message: str, fields: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.fields = fields or {}
