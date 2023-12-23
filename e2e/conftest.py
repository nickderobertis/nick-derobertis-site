from test.fixtures import *  # noqa: F401, F403

import pytest
from custom_playwright import customize_context_for_tests, customize_page_for_tests
from playwright.sync_api import expect
from settings import SETTINGS


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "ignore_https_errors": True,
        "base_url": SETTINGS.url,
    }


@pytest.fixture
def context(context):
    customize_context_for_tests(context)
    yield context


@pytest.fixture
def page(page):
    customize_page_for_tests(page)
    yield page


expect.set_options(timeout=SETTINGS.default_timeout)
