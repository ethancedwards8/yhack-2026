"""
LegiScan API wrapper (vendored from https://github.com/poliquin/pylegiscan,
ported to Python 3).
"""

import json
import os
from urllib.parse import urlencode

import requests

STATES = ['ak', 'al', 'ar', 'az', 'ca', 'co', 'ct', 'dc', 'de', 'fl', 'ga',
          'hi', 'ia', 'id', 'il', 'in', 'ks', 'ky', 'la', 'ma', 'md', 'me',
          'mi', 'mn', 'mo', 'ms', 'mt', 'nc', 'nd', 'ne', 'nh', 'nj', 'nm',
          'nv', 'ny', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx',
          'ut', 'va', 'vt', 'wa', 'wi', 'wv', 'wy']


class LegiScanError(Exception):
    pass


class LegiScan:
    BASE_URL = 'https://api.legiscan.com/?key={0}&op={1}&{2}'

    def __init__(self, apikey=None):
        if apikey is None:
            apikey = os.environ['LEGISCAN_API_KEY']
        self.key = apikey.strip()

    def _url(self, operation, params=None):
        if not isinstance(params, str) and params is not None:
            params = urlencode(params)
        elif params is None:
            params = ''
        return self.BASE_URL.format(self.key, operation, params)

    def _get(self, url):
        req = requests.get(url)
        if not req.ok:
            raise LegiScanError(f'Request returned {req.status_code}: {url}')
        data = req.json()
        if data['status'] == 'ERROR':
            raise LegiScanError(data['alert']['message'])
        return data

    def get_session_list(self, state):
        data = self._get(self._url('getSessionList', {'state': state}))
        return data['sessions']

    def get_master_list(self, state=None, session_id=None):
        if state is not None:
            url = self._url('getMasterList', {'state': state})
        elif session_id is not None:
            url = self._url('getMasterList', {'id': session_id})
        else:
            raise ValueError('Must specify session identifier or state.')
        data = self._get(url)
        return [data['masterlist'][i] for i in data['masterlist']]

    def get_bill(self, bill_id=None, state=None, bill_number=None):
        if bill_id is not None:
            url = self._url('getBill', {'id': bill_id})
        elif state is not None and bill_number is not None:
            url = self._url('getBill', {'state': state, 'bill': bill_number})
        else:
            raise ValueError('Must specify bill_id or state and bill_number.')
        return self._get(url)['bill']

    def get_bill_text(self, doc_id):
        return self._get(self._url('getBillText', {'id': doc_id}))['text']

    def get_amendment(self, amendment_id):
        return self._get(self._url('getAmendment', {'id': amendment_id}))['amendment']

    def get_supplement(self, supplement_id):
        return self._get(self._url('getSupplement', {'id': supplement_id}))['supplement']

    def get_roll_call(self, roll_call_id):
        return self._get(self._url('getRollcall', {'id': roll_call_id}))['roll_call']

    def get_sponsor(self, people_id):
        return self._get(self._url('getSponsor', {'id': people_id}))['person']

    def search(self, state, bill_number=None, query=None, year=2, page=1):
        if bill_number is not None:
            params = {'state': state, 'bill': bill_number}
        elif query is not None:
            params = {'state': state, 'query': query, 'year': year, 'page': page}
        else:
            raise ValueError('Must specify bill_number or query')
        data = self._get(self._url('search', params))['searchresult']
        summary = data.pop('summary')
        return {'summary': summary, 'results': [data[i] for i in data]}

    def __str__(self):
        return f'<LegiScan API {self.key}>'

    def __repr__(self):
        return str(self)
