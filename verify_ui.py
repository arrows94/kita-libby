from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5173")

        # Login
        page.fill('input[placeholder="Passwort"]', 'change-me')
        page.click('button:has-text("Login")')
        page.wait_for_selector('text=Logout')

        # Go to admin page
        page.click('button:has-text("Administration")')

        # Add a book
        page.fill('input[placeholder="z. B. 978-3-16-148410-0"]', '978-3-16-148410-0')
        # Title is required
        page.locator('label:has-text("Titel*") + input').fill('The Great Test Book')
        page.click('button:has-text("Buch hinzufügen")')

        # Wait for success toast
        page.wait_for_selector('text=The Great Test Book', timeout=5000)

        # Go to Search page
        page.click('button:has-text("Suche")')

        try:
            # Wait for the book cards to load
            page.wait_for_selector('article.card', timeout=5000)

            # Take a screenshot
            page.screenshot(path="ui_screenshot_accessibility.png")

            # Select the first book card
            card = page.locator('article.card').first

            # Check attributes
            role = card.get_attribute('role')
            tabindex = card.get_attribute('tabindex')

            print(f"Role: {role}")
            print(f"TabIndex: {tabindex}")

            # Focus via script to simulate keyboard tabbing
            card.focus()

            # Take a screenshot to see focus state
            page.screenshot(path="ui_screenshot_focus.png")

            # Try to trigger Enter
            page.keyboard.press('Enter')

            # Wait for modal to open (assuming it opens a modal)
            page.wait_for_selector('.modal', state='visible', timeout=5000)
            page.screenshot(path="ui_screenshot_modal_open.png")

            print("Success: Opened modal via keyboard")
        except Exception as e:
            print(f"Error during interaction: {e}")
            page.screenshot(path="ui_screenshot_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
