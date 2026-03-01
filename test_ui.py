from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_timeout(2000)

        # Take a screenshot of the simplified logged-out header
        page.screenshot(path="ui_screenshot_logged_out.png", full_page=True)

        # Login
        page.fill('input[type="password"]', "change-me")
        page.click('button:has-text("Login")')
        page.wait_for_timeout(2000)

        # Take a screenshot of the logged-in header showing admin links
        page.screenshot(path="ui_screenshot_logged_in.png", full_page=True)

        # Navigate to /manage
        page.click('button:has-text("Verwalten")')
        page.wait_for_timeout(2000)

        # Open recommendations settings
        page.click('button:has-text("Einstellungen öffnen")')
        page.wait_for_timeout(2000)

        # Take a screenshot of the manage page
        page.screenshot(path="ui_screenshot_manage.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    run()
