import requests
import json

try:
    url = "http://localhost:5000/predict"
    files = {'file': open('unhappy_path_low_conf.log', 'rb')}
    r = requests.post(url, files=files)
    print("STATUS CODE:", r.status_code)
    print("RESPONSE BODY:")
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print("ERROR:", e)
