import pathlib

from nick_derobertis_site.general.models.pdf import PDFModel

ASSETS_PATH = pathlib.Path(__file__).parent.parent / 'assets'
IMAGES_PATH = ASSETS_PATH / 'images'
PDFS_PATH = ASSETS_PATH / 'pdfs'
GENERATED_PDFS_PATH = PDFS_PATH / 'generated'

CV_PDF_MODEL = PDFModel(pdf_path=str(GENERATED_PDFS_PATH / 'Nick DeRobertis CV.pdf'))
