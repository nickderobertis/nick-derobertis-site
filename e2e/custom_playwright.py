from playwright.sync_api import BrowserContext, Page
from settings import SETTINGS, Settings


def customize_context_for_tests(context: BrowserContext, settings: Settings = SETTINGS):
    """
    Note: modifies inplace
    """
    context.set_default_timeout(settings.default_timeout)


def customize_page_for_tests(page: Page):
    """
    Note: modifies inplace
    """
    page.set_viewport_size({"width": 1600, "height": 1200})
