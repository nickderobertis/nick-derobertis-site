import os

from nick_derobertis_site.general.config import IMAGES_PATH
from nick_derobertis_site.general.models.image import ImageModel
from nick_derobertis_site.software_page.software_banner.software_banner_model import SoftwareBannerModel

SOFTWARE_BANNER_IMAGE_MODEL = ImageModel(image_path=os.path.join(IMAGES_PATH, 'software-banner.jpg'))

SOFTWARE_BANNER_MODEL = SoftwareBannerModel(
    header_text='Open-Source Software',
    sub_text='I am a strong believer in and avid developer of open-source software, '
             'especially Python packages. View the projects here or on my Github profile.',
    image=SOFTWARE_BANNER_IMAGE_MODEL
)
