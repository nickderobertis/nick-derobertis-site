import pytest
from playwright.sync_api import Page


@pytest.fixture
def page(page: Page):
    page.goto("")
    return page
