from playwright.sync_api import sync_playwright
import time

def test_admin_upload(page):
    # Log any console errors to help debugging
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("dialog", lambda dialog: dialog.accept())

    page.goto("http://localhost:5173")
    time.sleep(1)

    # Try different selectors for Admin tab
    admin_btn = page.locator('button:has-text("Administration")')
    if admin_btn.count() > 0:
        admin_btn.first.click()
        time.sleep(1)

    # Fill password and login
    print("Filling password...")
    page.fill('input[type="password"]', 'change-me')
    print("Clicking login...")
    page.locator('button:has-text("Login")').click()

    time.sleep(2)

    print("Taking screenshot...")
    page.screenshot(path="verification2.png", full_page=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    test_admin_upload(page)
    browser.close()
