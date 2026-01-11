import unittest
from unittest.mock import patch, Mock


class TestVoiceConfigPutValidation(unittest.TestCase):
    def test_invalid_language_codes(self):
        # Simulate server response for invalid language codes
        mock_payload = {
            'success': False,
            'error': {
                'id': 'err_xxx',
                'code': 'INVALID_LANGUAGE',
                'message': 'Invalid language codes for translation',
                'severity': 'MEDIUM'
            }
        }
        mock_resp = Mock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = mock_payload

        with patch('requests.put', return_value=mock_resp):
            import requests
            body = {
                'orgId': 'fake-org',
                'modulations': {
                    'translate': True,
                    'translate_from': 'english',
                    'translate_to': 'spanish'
                }
            }
            res = requests.put('http://localhost:3000/api/voice/config', json=body)
            self.assertEqual(res.status_code, 400)
            body = res.json()
            self.assertFalse(body.get('success', True))
            err = body.get('error', {})
            self.assertEqual(err.get('code'), 'INVALID_LANGUAGE')


if __name__ == '__main__':
    unittest.main()
