"""Typed V3 responses for the mascot's existing JSON contract."""

from typing import Literal

from app import schemas
from pydantic import BaseModel, Field


class MascotConfig(BaseModel):
    enabled: bool = False
    mascot: str = Field(default="chibiterasu", pattern=r"^(chibiterasu|nailong|kurisu|pet_[0-9a-f]{32})$")
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


class PetInfo(BaseModel):
    id: str
    name: str
    description: str
    version: Literal[1, 2]
    rows: Literal[9, 11]
    frame_map: list[list[tuple[int, int]]] | None = None
    icon: str
    sprite_url: str


class PetList(BaseModel):
    pets: list[PetInfo]


class PetResult(BaseModel):
    pet: PetInfo


class StatusData(BaseModel):
    config: MascotConfig
    summary: MascotSummary
    pets: list[PetInfo] = Field(default_factory=list)
    pet: PetInfo | None = None


class PublicStatusData(BaseModel):
    config: MascotConfig
    summary: PublicSummary
    pet: PetInfo | None = None


StatusResponse = schemas.Response[StatusData]
PublicStatusResponse = schemas.Response[PublicStatusData]
PetListResponse = schemas.Response[PetList]
PetResponse = schemas.Response[PetResult]
DeleteResponse = schemas.Response[None]
