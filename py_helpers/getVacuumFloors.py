import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.models.devices.vacuums import VacuumMapSummary, VacuumMapRoom
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) != 4 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password robrobovac_nickname")
  quit(1)

device_mac = "Not_Set"

client = Client(email=os.sys.argv[1], password=os.sys.argv[2])
roboVacNickname = os.sys.argv[3] 

for device in client.devices_list():

    if device.product.model == "JA_RO2" :
        if device.nickname == roboVacNickname :
            device_mac = device.mac

if device_mac == "Not_Set":
    sys.stdout = sys.stderr
    print(f"Vacuum not found in list of Wyze devices...")
    quit(1)


try:
    for map_summary in client.vacuums.get_maps(device_mac=device_mac):
      #print(f"    id: {map_summary.id}")
      #print(f"    name: {map_summary.name}")
      #print(f"    is current: {map_summary.is_current}")
      #print(f"    rooms: {map_summary.rooms}")
      print(f"All Rooms:{map_summary.name}")
      for room in map_summary.rooms:
        line = room.name + ":" + map_summary.name
        print(f"{line}")
        #tmpList = line.split(":")
        #print(f"after split, room = '{tmpList[0]}', floor = '{tmpList[1]}'")

    quit(0 )

except WyzeApiError as e:
    # You will get a WyzeApiError is the request failed
    sys.stdout = sys.stderr
    print(f"Got an error: {e}")
