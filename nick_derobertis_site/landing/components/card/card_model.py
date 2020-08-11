from dataclasses import dataclass
from typing import Optional


@dataclass
class CardModel:
    heading: str
    body_text: str
    image_path: str
    link: Optional[str] = None
