import os

from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.research_page.research_banner.research_banner_model import ResearchBannerModel

RESEARCH_BANNER_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'research-banner.jpg'))

RESEARCH_BANNER_MODEL = ResearchBannerModel(
    header_text="Research Works",
    sub_text="I am a Finance Ph.D. student at the University of Florida currently focusing on "
             "market intervention, alternative assets, and behavioral finance. Find my "
             "projects here or on my CV.",
    image=RESEARCH_BANNER_IMAGE_MODEL
)