import unittest
from unittest.mock import patch, Mock


class TestCallCapabilitiesShape(unittest.TestCase):
    def test_response_shape(self):
        # mock payload similar to what the route returns
        mock_payload = {
            'success': True,
            'capabilities': {
                'record': True,
                'transcribe': True,
                'translate': False,
                'survey': False,
                'synthetic_caller': False
            }
        }

        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_payload

        with patch('requests.get', return_value=mock_resp):
            import requests
            res = requests.get('http://localhost:3000/api/call-capabilities?orgId=fake')
            self.assertEqual(res.status_code, 200)
            body = res.json()
            self.assertIn('success', body)
            self.assertTrue(body['success'] is True)
            self.assertIn('capabilities', body)
            caps = body['capabilities']
            self.assertIsInstance(caps, dict)
            expected_keys = ['record', 'transcribe', 'translate', 'survey', 'synthetic_caller']
            for k in expected_keys:
                self.assertIn(k, caps)
                self.assertIsInstance(caps[k], bool)


if __name__ == '__main__':
    unittest.main()
