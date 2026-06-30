import urllib.request
import urllib.error

routes = [
    '/',
    '/features',
    '/browse',
    '/pricing',
    '/download',
    '/support',
    '/login',
    '/api/public/plans',
    '/api/public/categories',
    '/api/public/channels/popular'
]

baseUrl = 'http://localhost:3000'

results = []

for route in routes:
    url = baseUrl + route
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'QA-Script'})
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            results.append((route, status, 'OK'))
    except urllib.error.HTTPError as e:
        results.append((route, e.code, e.reason))
    except urllib.error.URLError as e:
        results.append((route, 'ERROR', str(e.reason)))

print("QA Test Results:")
for r in results:
    print(f"{r[0]:<30} {r[1]:<10} {r[2]}")
