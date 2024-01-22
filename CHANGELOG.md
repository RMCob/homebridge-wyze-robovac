# homebridge-wyze-robovac

All changes to the software will be documented here.

## V1.5.0
- Do not abort if wyze_sdk reports finding unknown devices.

## V1.4.1
- Updated  CHANGELOG.md

## V1.4.0
- Updated authentication process to utilize API_KEY and KEY_ID.

## V1.3.1
- Fixed dependency error

## V1.3.0
- Added logic to deal with multiple floor maps, a capability that is available in certain versions of the firmware. If your vacuum does not have the multi-floor mapping firmware it will default to have one floor named 'Main Floor'.
- If you have maps for multiple floors, the plugin will now identify the rooms on all floors and create accessory switches for each. Prior versions of the plugin only identified the rooms in the 'current' map as specified in the Wyze app.
- Names for switch accessories now have the floor name appended to them when they are created. A side effect of this is that room and floor names cannot contain the ':' (colon) character when they are specified in the Wyze app. The names can be modified later in HomeKit as needed.
- If you start sweeping a room that is on a different floor than the 'current' floor shown in the Wyze app, the plugin will cause the map shown in the app to change to the floor the room being swept is on.
- Updating from a previous version of the plugin will most likely cause the existing vacuum accessory switches to be orphaned and non-responsive. If this happens you will need to use the Homebridge UI (Homebridge Settings) to remove the cache entries for those
 accessories.

## V1.2.1 
- Fixed typos in README.md

## V1.2.0 
- Changed the BatteryCheck algorithm to not pound the Wyze servers so much. There are now 2 referesh intervals specified, one for when the vacuum is busy or has less than 100% charge, and one for when the vacuum is idle with 100% charge.
- Changed the refresh interval specifications on the Settings page (and in config.json) from milliseconds to seconds. If you are updating this plugin be sure to go to the Settings page and change the value for statusCheckRefreshInterval to be in seconds. 

## V1.1.3 
- Fixed typos in README.md

## V1.1.2 
- Minor logging improvement when finished sweeping. Fixed typos in README.md

## V1.1.1 
- Updated README.md regarding the display of the battery charge level

## V1.1.0 
- Added a faux Humidity sensor to display the vacuum's current battery charge level

## V1.0.0 
- first 'Homebridge Verified' version. Updated README.md

## V0.0.10 
- Clear currentRoomName after room sweeping is completed

## V0.0.9 
- Fixed typo in getVacuumDeviceList.py

## V0.0.8 
- Check that all required config settings have been supplied before starting plugin.

## V0.0.5 
- First 'official' release 

## V0.0.5-0 
- No changes. Working out the kinks of the publish/delivery process

## V0.0.4-beta
- config.schema.json - Added debugLevel to Settings options.
- platform.ts - Added config checks. If all required config parameters are not set, do not start the plugin.


## V0.0.3-beta: Initial release to beta testers
- plarform.ts, platformAccessory.ts, py_stubs/* - Added logic to deal with multiple vacuums on same account.

## V0.0.2-beta:
- First working build with full functionality

