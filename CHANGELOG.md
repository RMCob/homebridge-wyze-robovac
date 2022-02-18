# homebridge-wyze-robovac

All changes to the software will be documented here.

## V1.1.1 
- Updated README.md regarding the display of the battery charge level.

## V1.1.0 
- Added a faux Humidity sensor to display the vacuum's current battery charge level.

## V1.0.0 
- first 'Homebridge Verified' version. Updated README.md

## V0.0.10 
- Clear currentRoomName after room sweeping is completed

## V0.0.9 
- Fixed typo in getVacuumDeviceList.py

## V0.0.8 
- Check that all required config settings have been supplied before starting plugin.

## V0.0.5 
- First 'official' release' 

## V0.0.5-0 
- No changes. Working out the kinks of the publish/delivery process

## V0.0.4-beta
- config.schema.json - Added debugLevel to Settings options.
- platform.ts - Added config checks. If all required config parameters are not set, do not start the plugin.


## V0.0.3-beta: Initial release to beta testers
- plarform.ts, platformAccessory.ts, py_stubs/* - Added logic to deal with multiple vacuums on same account.

## V0.0.2-beta:
- First working build with full functionality

