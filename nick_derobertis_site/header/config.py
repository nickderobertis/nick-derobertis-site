import os

from nick_derobertis_site.general.config import IMAGES_PATH, CV_PDF_MODEL
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.header.header_model import HeaderModel


ND_LOGO_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'nd-logo.svg'))

HEADER_MODEL = HeaderModel(logo=ND_LOGO_IMAGE_MODEL, pdf=CV_PDF_MODEL)