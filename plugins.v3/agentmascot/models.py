"""Typed V3 responses for the mascot's existing JSON contract."""

from typing import Literal

from pydantic import BaseModel, Field

from app import schemas


class MascotConfig(BaseModel):
    enabled: bool = False
    mascot: Literal["chibiterasu", "nailong", "kurisu"] = "chibiterasu"
    replace_agent_entry: bool = True
    show_sidebar_nav: bool = True
    scale: float = Field(default=1.0, ge=0.6, le=4.0)
    speed: float = Field(default=1.0, ge=0.4, le=2.0)
    follow_mouse: bool = True
    auto_roam: bool = True
    shadow: bool = True


class PublicSummary(BaseModel):
    enabled: bool
    replace_agent_entry: bool


class MascotSummary(PublicSummary):
    avatar: str
    actions: list[str]


class StatusData(BaseModel):
    config: MascotConfig
    summary: MascotSummary


class PublicStatusData(BaseModel):
    config: MascotConfig
    summary: PublicSummary


StatusResponse = schemas.Response[StatusData]
PublicStatusResponse = schemas.Response[PublicStatusData]
