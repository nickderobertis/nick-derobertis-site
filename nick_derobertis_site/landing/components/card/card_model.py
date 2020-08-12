import param

from nick_derobertis_site.common.model import ComponentModel

PLACEHOLDER_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAHd3dwAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='


class CardModel(ComponentModel):
    heading = param.String()
    body_text = param.String()
    image_path = param.String(default=PLACEHOLDER_IMAGE)
    link = param.String(default=None)
