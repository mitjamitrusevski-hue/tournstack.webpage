"""Isolated browser checks: every request is fulfilled locally; no live votes."""
import json
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright

SCRIPT = (Path(__file__).resolve().parents[2] / 'assets/js/blog.js').read_text(encoding='utf-8')
ARTICLE = 'TS-BLOG-0001'


class LikesBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(channel='chrome', headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 900, 'height': 700})
        self.page = self.context.new_page()
        self.requests = []
        self.state = {'liked': False, 'count': 8}
        self.tokens = {}
        self.fail_get = False
        self.lose_write_response = False
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.context.close()

    def load(self, staging=False):
        html = '<!doctype html><html><body' + (' data-staging="true"' if staging else '') + '><h1>Story</h1><div style="height:1800px"></div>'
        html += f'<button data-blog-like="{ARTICLE}">Like</button><span role="status" data-like-status></span>'
        html += f'<button data-blog-like="{ARTICLE}">Like</button><script>{SCRIPT}</script></body></html>'
        def route(request):
            if '/api/blog-likes/' in request.request.url:
                self.requests.append(request.request)
                if request.request.method == 'GET' and self.fail_get:
                    return request.fulfill(status=503, body='{}', content_type='application/json')
                if request.request.method == 'PUT':
                    token = request.request.headers.get('authorization')
                    target = request.request.post_data_json['liked']
                    if target != self.tokens.get(token, False):
                        self.state['count'] += 1 if target else -1
                    self.state['liked'] = target
                    self.tokens[token] = target
                    if self.lose_write_response:
                        self.lose_write_response = False
                        return request.abort('failed')
                return request.fulfill(status=200, body=json.dumps({'article_id': ARTICLE, 'count': self.state['count'],
                    'liked': self.tokens.get(request.request.headers.get('authorization'), False),
                    'expires_at': 1893456000 if request.request.headers.get('authorization') in self.tokens else None}), content_type='application/json')
            if request.request.url == 'https://tournstack.com/__likes-test':
                return request.fulfill(status=200, body=html, content_type='text/html')
            self.fail('Unexpected request: ' + request.request.url)
        self.context.route('**/*', route)
        self.page.goto('https://tournstack.com/__likes-test', wait_until='load')
        self.buttons = self.page.locator('[data-blog-like]')

    def test_lazy_read_no_identifier_then_shared_states_and_unlike(self):
        self.load()
        self.page.wait_for_timeout(150)
        self.assertEqual(len(self.requests), 0)
        self.assertEqual(self.page.evaluate('localStorage.length'), 0)
        self.buttons.first.scroll_into_view_if_needed()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').textContent.includes('8')")
        self.assertEqual([r.method for r in self.requests], ['GET'])
        self.assertEqual(self.page.evaluate('localStorage.length'), 0)
        self.buttons.first.click()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').getAttribute('aria-pressed') === 'true'")
        self.assertEqual(self.buttons.nth(1).get_attribute('aria-pressed'), 'true')
        self.assertIn('\u2665', self.buttons.first.inner_text())
        self.assertIn('\u00b7', self.buttons.first.inner_text())
        self.assertEqual(self.state, {'liked': True, 'count': 9})
        self.assertEqual(self.page.evaluate('localStorage.length'), 1)
        self.buttons.nth(1).click()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').getAttribute('aria-pressed') === 'false'")
        self.assertEqual(self.state, {'liked': False, 'count': 8})
        tokens = [r.headers.get('authorization') for r in self.requests if r.method == 'PUT']
        self.assertEqual(tokens[0], tokens[1])

    def test_staging_no_requests_or_storage(self):
        self.load(staging=True)
        self.buttons.first.scroll_into_view_if_needed()
        self.page.wait_for_timeout(200)
        self.assertTrue(self.buttons.first.is_disabled())
        self.assertEqual(self.requests, [])
        self.assertEqual(self.page.evaluate('localStorage.length'), 0)

    def test_failed_count_has_no_fake_zero_and_can_retry(self):
        self.fail_get = True
        self.load()
        self.buttons.first.scroll_into_view_if_needed()
        self.page.wait_for_function("document.querySelector('[data-like-status]').textContent.includes('unavailable')")
        self.assertNotIn('0', self.buttons.first.inner_text())
        self.fail_get = False
        self.buttons.first.click()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').getAttribute('aria-pressed') === 'true'")
        self.assertEqual(self.state['count'], 9)

    def test_lost_write_confirmation_retries_original_intent_not_opposite(self):
        self.load()
        self.buttons.first.scroll_into_view_if_needed()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').textContent.includes('8')")
        self.lose_write_response = True
        self.buttons.first.click()
        self.page.wait_for_function("!document.querySelector('[data-blog-like]').disabled")
        self.assertEqual(self.state['count'], 9)
        self.buttons.first.click()
        self.page.wait_for_function("document.querySelector('[data-like-status]').textContent === 'Thanks for your like.'")
        self.assertEqual(self.state, {'liked': True, 'count': 9})
        self.assertEqual(len([r for r in self.requests if r.method == 'PUT']), 1)

    def two_tabs(self):
        self.load()
        self.buttons.first.scroll_into_view_if_needed()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').textContent.includes('8')")
        first = self.page
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.load()
        self.buttons.first.scroll_into_view_if_needed()
        self.page.wait_for_function("document.querySelector('[data-blog-like]').textContent.includes('8')")
        self.assertEqual(self.page.evaluate('localStorage.length'), 0)
        return first, self.page

    def test_two_preopened_tabs_share_first_token_and_preserve_like_intent(self):
        first, second = self.two_tabs()
        first.locator('[data-blog-like]').first.click()
        first.wait_for_function("document.querySelector('[data-like-status]').textContent === 'Thanks for your like.'")
        self.assertEqual(second.locator('[data-blog-like]').first.get_attribute('aria-pressed'), 'false')
        second.locator('[data-blog-like]').first.click()
        second.wait_for_function("document.querySelector('[data-like-status]').textContent === 'Thanks for your like.'")
        self.assertEqual(self.state, {'liked': True, 'count': 9})
        self.assertEqual(len([r for r in self.requests if r.method == 'PUT']), 1)

    def test_simultaneous_first_likes_use_one_shared_reference(self):
        first, second = self.two_tabs()
        first.locator('[data-blog-like]').first.evaluate('(button) => button.click()')
        second.locator('[data-blog-like]').first.evaluate('(button) => button.click()')
        for page in [first, second]:
            page.wait_for_function("document.querySelector('[data-like-status]').textContent === 'Thanks for your like.'")
        self.assertEqual(self.state, {'liked': True, 'count': 9})
        self.assertEqual(len([r for r in self.requests if r.method == 'PUT']), 1)


if __name__ == '__main__':
    unittest.main()
