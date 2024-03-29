import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) < 6 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password wyze_key_id wyze_api_key robrobovac_nickname")
  quit(1)


client = Client(email=os.sys.argv[1], password=os.sys.argv[2], key_id=os.sys.argv[3], api_key=os.sys.argv[4])
roboVacNickname = os.sys.argv[5] 

for device in client.devices_list():
    if device.product.model == "JA_RO2":
        if device.nickname == roboVacNickname :
            device_mac = device.mac

if device_mac == "Not_Set":
    sys.stdout = sys.stderr
    print(f"Vacuum not found in list of Wyze devices...")
    quit(1)

try:
  vacuum = client.vacuums.info(device_mac=device_mac)

  from wyze_sdk.models.devices import VacuumMode
  
  if vacuum.mode != VacuumMode.IDLE:
    client.vacuums.dock(device_mac=device_mac, device_model=vacuum.product.model)
  else:
    sys.stdout = sys.stderr
    print(f"RoboVac is already docked....")
    quit(1)

  print(f"Vacuum successfully sent back to charge....")
  quit(0)

except WyzeApiError as e:
    # You will get a WyzeApiError if the request failed
    sys.stdout = sys.stderr
    print(f"Got an error: {e}")
