import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.models.devices.vacuums import VacuumMapSummary
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) != 7 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password wyze_key_id wyze_api_key robrobovac_nickname floor_name")
  quit(1)

device_mac = "Not_Set"

client = Client(email=os.sys.argv[1], password=os.sys.argv[2], key_id=os.sys.argv[3], api_key=os.sys.argv[4])
roboVacNickname = os.sys.argv[5] 
newFloorName = os.sys.argv[6] 

for device in client.devices_list():

    if device.product.model == "JA_RO2" :
        if device.nickname == roboVacNickname :
            device_mac = device.mac

if device_mac == "Not_Set":
    sys.stdout = sys.stderr
    print(f"Vacuum not found in list of Wyze devices...")
    quit(1)


try:
    newFloorID=0
    for map_summary in client.vacuums.get_maps(device_mac=device_mac):
      if  map_summary.is_current :
        print(f"    current floor: {map_summary.name.strip()}")
      if map_summary.name.strip() == newFloorName :
        newFloorID=map_summary.id

    if newFloorID == 0 :
      print(f"     '{newFloorName}' is not a valid floor name")
      print(f"     Valid names are:")
      for map_summary in client.vacuums.get_maps(device_mac=device_mac):
        print(f"          {map_summary.name.strip()}")
      quit(1)

    client.vacuums.set_current_map(device_mac=device_mac, map_id=newFloorID)
    vacuum = client.vacuums.info(device_mac=device_mac)
    print(f"    current floor is now: {newFloorName}")

    quit(0)

except WyzeApiError as e:
    # You will get a WyzeApiError is the request failed
    sys.stdout = sys.stderr
    print(f"Got an error: {e}")
