import datetime

import param

from nick_derobertis_site.common.model import ComponentModel

BEGIN_YEAR = 2020


class FooterModel(ComponentModel):

    @property
    def copyright_years(self):
        current_year = datetime.datetime.now().year
        if BEGIN_YEAR == current_year:
            return str(current_year)
        else:
            return f'{BEGIN_YEAR}-{current_year}'