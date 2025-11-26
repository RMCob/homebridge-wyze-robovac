# homebridge-wyze-robovac
[![npm](https://img.shields.io/npm/v/homebridge-wyze-robovac)](https://www.npmjs.com/package/homebridge-wyze-robovac/v/latest)
[![npm](https://img.shields.io/npm/dt/homebridge-wyze-robovac)](https://www.npmjs.com/package/homebridge-wyze-robovac)
[![GitHub last commit](https://img.shields.io/github/last-commit/RMCob/homebridge-wyze-robovac)](https://github.com/RMCob/homebridge-wyze-robovac)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate/?business=G63Z63BWAJWZN&no_recurring=0&currency_code=USD)

## This plugin has been superceeded by matterbridge-wyze-robovac and is no longer supported.


This plugin adds rudimentary support for the Wyze Robot Vacuum device to [Homebridge](https://github.com/homebridge/homebridge).

## Background

Since HomeKit does not yet have a 'smart vacuum' framework, this plugin creates a separate 'switch' accessory for each room in the current Wyze app map for the vacuum. It also adds an "All Rooms" switch to do the entire map. Turning a switch 'On' will tell the vacuum to sweep that room. Turning it 'Off' will tell the vacuum to stop sweeping and return to the charging dock. In addition, a faux humidity sensor is created to display the vacuum's current battery charge level.

In the Home app, create a room named 'Vacuum' and move all the new switch accessories and the faux humidity sensor into that room. You can then say "Hey Siri, vacuum living room on" and the magic happens. :-) If you have multiple vacums the configuration is a bit more involved. See below.

## Requirements

Python version must be >= 3.8.3. 

wyze-sdk must be >= 2.0.0. Installation instructions are here: https://github.com/shauntarves/wyze-sdk.

Visit the Wyze developer API portal to generate an API ID/KEY: https://developer-api-console.wyze.com/#/apikey/view.
This info is used in the Settings UI. See the **`Configuration`** section below. Be careful to check that the generated keys do not contain any 'shell' special characters like '*' or '|' (vertical bar). If they do, delete the keys (via the web browser interface) and regenerate them.

## Caveats

- This plugin was developed and proved-in on a Rpi 4 running the latest version of Raspbian Linux (5.10.103-v7l+ #1529), and HomeBridge with the homebridge-ui-x plugin. If you are running in ANY other environment (Windows, Mac OS, Docker, Home Assistant, Synergy NAS, etc.) and have any issues with installation and or running, you are on your own. If you are successful in alternate environments I welcome your feedback so I can document it here.

- If you have multiple vacuums (one for each floor of your house), or if your vacuum has the multi-floormap firmware and you use 1 vacuum on multiple floors, you should create a different 'Vacuum' room in the Home app to represent each floor (ex: Vacuum First Floor, Vacuum Second Floor, etc.) and then move the accessories for each vacuum into the appropriate room. This will make things easier to manage. Once this is done you should remove the floor designation from the room name in Homekit. For example, when initially created the accessories may be named "Kitchen:Main Floor" or "Master Bedroom:Second Floor". These accessories should be renamed to be simply "Kitchen" or "Master Bedroom" once they have been moved to the appropriate HomeKit room. 

- Since names for switch accessories now have the floor name appended to them when they are created, room and floor names cannot contain the ':' (colon) character when they are specified in the Wyze app. The names can be modified later in HomeKit as needed.

- If you start sweeping a room that is on a different floor than the 'current' floor shown in the Wyze app, the plugin will cause the map shown in the app to change to the floor the room being swept is on. 

- Updating from a previous version < 1.3.0 of the plugin will most likely cause the existing vacuum accessory switches to be orphaned and non-responsive. If this happens you will need to use the Homebridge UI (Homebridge Settings) to remove the cache entries for those
 accessories.

- You can only ask to sweep one room at a time (or All Rooms) for a particular vacuum. Only one 'switch' can be on at a time for the same device.

- The statusCheckRefreshInterval indicates how often to check that the vacuum is still sweeping after being started. When the vacuum stops sweeping the associated switch icon will be turned off. This means it could take up to 30 seconds (default) for the icon to indicate the vacuum is done. Wyze servers start ignoring requests if you poll them too often.

- From the time a room switch is 'pressed', it takes 10-15 seconds for the vacuum to activate.

### Error Indications

The Wyze API indicates the vacuum is sweeping but does not return any 'room' information. If the vacuum was already started sweeping by the Wyze app when you try to start it via the plugin, nothing will happen. The switch will just turn itself off. I don't like it either but that's how it works now.

If you start the vacuum sweeping and then try to turn on a different room 'switch' (i.e. - pick a different room), the second switch will turn off with an '!' in the icon, indicating the error. To change rooms, first turn off the room that's being swept.

## Configuration

Use the settings UI in Homebridge Config UI X to configure your Wyze account, or manually add the following to the platforms section of your config file. See the **`Requirements`** section above for instructions on how to get your API_KEY and KEY_ID:

```js
{
  "platforms": [
    {
      "platform": "WyzeRoboVac",
      "name": "WyzeRoboVac",
      "username": "YOUR_EMAIL",
      "password": "YOUR_PASSWORD",
      "mfaCode": "YOUR_2FA_AUTHENTICATION_PIN",
      "key_id": "YOUR WYZE ACCOUNT KEY_ID",
      "api_key": "YOUR WYZE ACCOUNT API_KEY",
      "statusCheckRefreshInterval": "Refresh Interval for status checks after sweeping starts. Default 30 sec",
      "idleBatteryCheckRefreshInterval": "Refresh Interval for battery checks when idle. Default 1800 seconds (30 min)",
      "busyBatteryCheckRefreshInterval": "Refresh Interval for battery checks when busy or charge level < 100. Default 120 seconds (2 min)",
      "path2py_stubs": "Path to Python helper scripts. Default '/usr/lib/node_modules/homebridge-wyze-robovac/py_helpers'",
      "debugLevel": "Can be 0 (no logging), 1 (log.info), or 2 (log.debug)"
    }
  ]
}
```

Supported devices will be discovered and added to Homebridge automatically.

### Optional fields

* **`mfaCode`** &ndash; Only required for the initial login if you have two-factor authentication enabled for your account. This is typically a 6-digit code provided by your authenticator app.
* **`statusCheckRefreshInterval`** &ndash; Defines how often the status of the vacuum will be polled in seconds after sweeping has started (e.g., `"statusCheckRefreshInterval": 60` will check your devices' status every 60 seconds). Defaults to 30 seconds.
* **`idleBatteryCheckRefreshInterval`** &ndash; Defines how often to check the battery level of the vacuum when it is idle and the battery level = 100. (e.g., `"idleBatteryCheckRefreshInterval": 2700` will check the battery level every 45 minutes. Defaults to 1800 seconds (30 minutes).
* **`busyBatteryCheckRefreshInterval`** &ndash; Defines how often to check the battery level of the vacuum when it is busy or the battery level < 100. (e.g., `"busyBatteryCheckRefreshInterval": 60` will check the battery level every minute. Defaults to 120 seconds (2 minutes).

## Other Info

Special thanks to the following projects for reference and inspiration:

- [wyze-sdk](https://github.com/shauntarves/wyze-sdk), a Python library for controlling the Wyze Robot Vacuum and other Wyze products.
- [homebridge-plugin-template](https://github.com/homebridge/homebridge-plugin-template), a Dynamic Platform example.

Thanks again to [Shaun Tarves](https://github.com/shauntarves/wyze-sdk) for the Python libraries that this plugin utilizes, and thanks to others for volunteering their time to help fix bugs and add support for other features.
