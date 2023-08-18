import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) != 5 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password wyze_keyid wyze_apikey")
  quit(1)

client = Client(email=os.sys.argv[1], password=os.sys.argv[2], keyid=os.sys.argv[3], apikey=os.sys.argv[4])

for device in client.devices_list():
    if device.product.model == "JA_RO2":
        print(f"{device.nickname}")

