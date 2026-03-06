from playwright.sync_api import sync_playwright

def test_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto('http://localhost:5173')

        # Wait for the book grid and articles to be rendered
        page.wait_for_selector('.book-grid article')

        # Verify 50 books are loaded initially
        books = page.query_selector_all('.book-grid article')
        print(f"Initial books count: {len(books)}")
        page.screenshot(path="verification_initial.png")

        # Verify load more button exists and works
        load_more_btn = page.locator('button:has-text("Mehr laden")')
        if load_more_btn.is_visible():
            load_more_btn.click()
            page.wait_for_timeout(1000) # Wait for render

            books_after = page.query_selector_all('.book-grid article')
            print(f"Books count after load more: {len(books_after)}")

        page.screenshot(path="verification_after.png")

        # Try search
        search_input = page.locator('input[aria-label="Suche"]')
        search_input.fill("Test Book 1")
        page.wait_for_timeout(1000) # Wait for render
        books_search = page.query_selector_all('.book-grid article')
        print(f"Books count after search: {len(books_search)}")
        page.screenshot(path="verification_search.png")

        browser.close()

if __name__ == "__main__":
    test_frontend()
