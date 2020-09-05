from nick_derobertis_site.general.widgets.button import ButtonModel
from nick_derobertis_site.landing.components.contact_pane.contact_pane_model import ContactPaneModel

CONTACT_BUTTON_MODELS = [
    ButtonModel(display_text='See Research', page_path='research'),
    ButtonModel(display_text='See Courses', page_path='courses'),
    ButtonModel(display_text='See Software', page_path='software'),
]

CONTACT_PANE_MODEL = ContactPaneModel(email='derobertisna@ufl.edu', button_models=CONTACT_BUTTON_MODELS)
