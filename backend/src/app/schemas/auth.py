from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RoleOut(ORMModel):
    id: str
    name: str
    description: str | None = None


class UserOut(ORMModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    role: RoleOut


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
