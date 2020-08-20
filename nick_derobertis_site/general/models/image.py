import base64
import os

import param


class ImageModel(param.Parameterized):
    image_path: str = param.String()
    image_type: str = param.String()
    src: str = param.String()

    def __init__(self, **params):
        super().__init__(**params)
        if not self.image_type:
            self._set_image_type()
        self._set_src()
        self.param.watch(self._set_image_type_and_src, 'image_path')

    def _set_image_type_and_src(self):
        self._set_image_type()
        self._set_src()

    def _set_src(self):
        with open(self.image_path, 'rb') as f:
            contents = f.read()
        b64 = base64.b64encode(contents).decode('utf8')
        src = f"data:image/{self.image_type};base64,{b64}"
        self.src = src

    def _set_image_type(self):
        filename, file_extension = os.path.splitext(self.image_path)
        file_extension = file_extension[:1]  # remove . at beginning
        self.image_type = file_extension.lower()
