import base64

import param


class PDFModel(param.Parameterized):
    pdf_path: str = param.String()
    src: str = param.String()

    def __init__(self, **params):
        super().__init__(**params)
        if not self.src:
            self._set_src()
        self.param.watch(self._set_src, 'pdf_path')

    def _set_src(self):
        with open(self.pdf_path, 'rb') as f:
            contents = f.read()
        b64 = base64.b64encode(contents).decode('utf8')
        src = f"data:application/pdf;base64,{b64}"
        self.src = src

