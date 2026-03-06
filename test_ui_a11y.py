from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_timeout(2000)

        # Login
        page.fill('input[type="password"]', "change-me")
        page.click('button:has-text("Login")')
        page.wait_for_timeout(2000)

        # Navigate to admin to add a book if none exists, else just try to see what's on the page
        page.screenshot(path="ui_screenshot_a11y_home.png", full_page=True)

        # Open filter panel
        if page.locator('button:has-text("Filter anzeigen")').is_visible():
            page.click('button:has-text("Filter anzeigen")')
            page.wait_for_timeout(1000)
            page.screenshot(path="ui_screenshot_a11y_list.png", full_page=True)

        if page.locator('article.card[role="button"]').count() > 0:
            page.locator('article.card[role="button"]').first.click()
            page.wait_for_timeout(1000)
            page.screenshot(path="ui_screenshot_a11y_modal.png", full_page=True)

            if page.locator('button:has-text("Metadaten finden")').is_visible():
                page.click('button:has-text("Metadaten finden")')
                page.wait_for_timeout(3000)
                page.screenshot(path="ui_screenshot_a11y_lookup.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    run()