import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) != 6 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password wyze_keyid wyze_apikey robovac_nickname")
  quit(1)

device_mac = "Not_Set"

client = Client(email=os.sys.argv[1], password=os.sys.argv[2], keyid=os.sys.argv[3], apikey=os.sys.argv[4])
roboVacNickname = os.sys.argv[5] 

for device in client.devices_list() :
    if device.product.model == "JA_RO2" :
        if device.nickname == roboVacNickname :
            device_mac = device.mac

if device_mac == "Not_Set" :
    sys.stdout = sys.stderr
    print(f"Vacuum not found in list of Wyze devices...")
    quit(1)

try:
  vacuum = client.vacuums.info(device_mac=device_mac)

  from wyze_sdk.models.devices import VacuumMode
  
  print(f"All Rooms")
  for room in vacuum.current_map.rooms: 
      print(f"{room.name}")

  quit(0)

except WyzeApiError as e:
  # You will get a WyzeApiError is the request failed
  sys.stdout = sys.stderr
  print(f"Got an error: {e}")
