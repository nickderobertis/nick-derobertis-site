from nick_derobertis_site.landing.components.card.card_model import CardModel

LANDING_CARD_MODELS = [
    CardModel(
        heading='Research',
        body_text="""
        I am a skilled empirical researcher working in the finance field.
        My latest work focuses on central bank intervention in markets 
        and cryptocurrency valuation. 
        """,
        link='research',
        link_display_text='See Research',
        icon_classes=['fas', 'fa-chart-bar', 'fa-5x'],
    ),
    CardModel(
        heading='Teaching',
        body_text="""
        I've taught multiple courses at multiple universities.
        Currently I am teaching Financial Modeling using 
        Python and Excel at the University of Florida.
        """,
        link='courses',
        link_display_text='See Courses',
        icon_classes=['fas', 'fa-graduation-cap', 'fa-5x'],
    ),
    CardModel(
        heading='Engineering',
        body_text="""
        Whether it is a data science problem,
        finding the best way to teach a topic, or 
        building a web app, I optimize my approach
        and usually build open-source tools along the way.
        """,
        link='software',
        link_display_text='See Software',
        icon_classes=['fas', 'fa-cogs', 'fa-5x'],
    ),
]