from playwright.sync_api import Page, expect

initial_title_text = "Serial Founder & Full-Stack Software Engineer"


def test_home_page_loads(page: Page):
    expect(page.get_by_text(initial_title_text)).to_be_visible()


def test_home_page_displays_timeline(page: Page):
    expect(page.get_by_text("Eastern Virginia Bankshares").first).to_be_visible()


def test_home_page_displays_skills(page: Page):
    expect(page.get_by_text("Selenium").first).to_be_visible()
