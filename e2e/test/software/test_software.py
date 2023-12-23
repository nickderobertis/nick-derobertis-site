from playwright.sync_api import Page, expect

initial_title_text = "Open-Source Software"


def test_software_page_loads_and_shows_software(page: Page):
    expect(page.get_by_text(initial_title_text).first).to_be_visible()
    # Check project name
    expect(page.get_by_text("py-ex-latex").first).to_be_visible()
    # Check project display name
    expect(page.get_by_text("Python Extends LaTeX")).to_be_visible()
    # Check description
    expect(page.get_by_text("Create LaTeX documents using only Python")).to_be_visible()
