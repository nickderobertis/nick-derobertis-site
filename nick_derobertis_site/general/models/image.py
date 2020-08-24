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
        if not self.src:
            self._set_src()
        self.param.watch(self._set_image_type_and_src, 'image_path')

    def _set_image_type_and_src(self):
        self._set_image_type()
        self._set_src()

    def _set_src(self):
        if self.image_type == 'svg+xml':
            with open(self.image_path, 'r') as f:
                contents = f.read()
            content_idx = contents.find('<svg')
            self.src = contents[content_idx:]
            return

        with open(self.image_path, 'rb') as f:
            contents = f.read()
        b64 = base64.b64encode(contents).decode('utf8')
        src = f"data:image/{self.image_type};base64,{b64}"
        self.src = src

    def _set_image_type(self):
        filename, file_extension = os.path.splitext(self.image_path)
        file_extension = file_extension[1:]  # remove . at beginning
        file_extension = file_extension.lower()

        if file_extension == 'svg':
            self.image_type = 'svg+xml'
        else:
            self.image_type = file_extension
