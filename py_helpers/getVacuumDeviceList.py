import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) != 3 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password")
  quit(1)

client = Client(email=sys.argv[1], password=os.sys.argv[2])

for device in client.devices_list():
    if device.product.model == "JA_RO2":
        print(f"{device.nickname}")

