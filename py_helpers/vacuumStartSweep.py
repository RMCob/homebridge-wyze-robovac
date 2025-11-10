import os
import sys
import logging
import wyze_sdk
from wyze_sdk import Client
from wyze_sdk.errors import WyzeApiError

if len(sys.argv) < 7 :
  sys.stdout = sys.stderr
  print(f"USAGE: {sys.argv[0]} wyze_email wyze_password wyze_key_id wyze_api_key \
                                      robrobovac_nickname roomname [roomname...]")
  quit(1)

rooms2clean = []
num_rooms2clean = len(sys.argv) 

I = 6
while I <= num_rooms2clean:
    #print(f"I = {I}, sys.argv[I] = '{sys.argv[I-1]}'")
    rooms2clean.append(sys.argv[I-1])
    I+=1

#print(f"rooms2clean = {rooms2clean}")

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
  
  if vacuum.mode == VacuumMode.SWEEPING:
    sys.stdout = sys.stderr
    print(f"RoboVac is already sweeping. Stop the current sweep and try again...")
    quit(1)

  #print(f"vacuum.current_map.rooms = {vacuum.current_map.rooms}")
  #for roomname in rooms2clean:
  #    print(f"roomname = '{roomname}'")

  room_ids=[]

  for room in vacuum.current_map.rooms:
    for roomname in rooms2clean:
      if room.name == roomname:
        room_ids.append( room.id )

  client.vacuums.sweep_rooms(device_mac=device_mac, room_ids=room_ids)
  print(f"Sweeping started successfully...")
  quit(0)

except WyzeApiError as e:
    # You will get a WyzeApiError if the request failed
    sys.stdout = sys.stderr
    print(f"Got an error: {e}")
