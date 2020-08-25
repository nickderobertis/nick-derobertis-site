import os

from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.general.widgets.button import PrimaryButton
from nick_derobertis_site.landing.components.story_highlight_pane.story_highlight_pane_model import \
    StoryHighlightPaneModel

STORY_HIGHLIGHT_PANE_BUTTON = PrimaryButton(display_text='See Story', page_path='story')

STORY_HIGHLIGHT_PANE_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'nick-derobertis.jpg'))

STORY_HIGHLIGHT_PANE_MODEL = StoryHighlightPaneModel(
    button=STORY_HIGHLIGHT_PANE_BUTTON, image=STORY_HIGHLIGHT_PANE_IMAGE_MODEL
)