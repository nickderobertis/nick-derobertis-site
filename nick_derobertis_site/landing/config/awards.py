import os
from typing import List

from derobertis_cv.pldata.awards import get_awards

from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.landing.components.awards_pane.award.award_model import AwardModel
from nick_derobertis_site.landing.components.awards_pane.awards_pane_model import AwardsPaneModel

SELECT_AWARD_NAMES = [
    'Warrington College of Business Ph.D. Student Teaching Award',
    'CFA Global Investment Research Challenge – Global Semi-Finalist',
    'Finance Student of the Year',
]

LAUREL_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'laurel.svg'))

AWARD_CV_MODELS = get_awards(include_awards=SELECT_AWARD_NAMES, order=SELECT_AWARD_NAMES)

AWARD_MODELS: List[AwardModel] = [AwardModel.from_cv_model(model, LAUREL_IMAGE_MODEL) for model in AWARD_CV_MODELS]

AWARDS_PANE_MODEL = AwardsPaneModel(award_models=AWARD_MODELS)