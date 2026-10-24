from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class MeOut(BaseModel):
    authenticated: bool
    email: str | None = None
