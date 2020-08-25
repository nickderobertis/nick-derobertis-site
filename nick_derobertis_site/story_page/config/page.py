import os

from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.story_page.story_page_model import StoryPageModel

STORY_BACKGROUND_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'story-cover.png'))

STORY_PAGE_MODEL = StoryPageModel(
    page_title="Nick DeRobertis' Story",
    page_link_text='Story',
    image=STORY_BACKGROUND_IMAGE_MODEL
)