# homebridge-wyze-robovac
[![npm](https://img.shields.io/npm/v/homebridge-wyze-robovac)](https://www.npmjs.com/package/homebridge-wyze-robovac/v/latest)
[![npm](https://img.shields.io/npm/dt/homebridge-wyze-robovac)](https://www.npmjs.com/package/homebridge-wyze-robovac)
[![GitHub last commit](https://img.shields.io/github/last-commit/RMCob/homebridge-wyze-robovac)](https://github.com/RMCob/homebridge-wyze-robovac)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate/?business=G63Z63BWAJWZN&no_recurring=0&currency_code=USD)

This plugin adds rudimentary support for the Wyze Robot Vacuum device to [Homebridge](https://github.com/homebridge/homebridge).

## Background

Since HomeKit does not yet have a 'smart vacuum' framework, this plugin creates a separate 'switch' accessory for each room in the current Wyze app map for the vacuum. It also adds an "All Rooms" switch to do the entire map. Turning a switch 'On' will tell the vacuum to sweep that room. Turning it 'Off' will tell the vacuum to stop sweeping and return to the charging dock. In addition, a faux humidity sensor is created to display the vacuum's current battery charge level.

In the Home app, create a room named 'Vacuum' and move all the new switch accessories and the faux humidity sensor into that room. You can then say "Hey Siri, vacuum living room on" and the magic happens. :-) If you have multiple vacums the configuration is a bit more involved. See below.

## Requirements

Python version must be >= 3.7.3. The README for wyze-sdk indicates >= 3.8, but 3.7.3 is the latest available for Debian on the RPi and it seems to be working ok.

wyze-sdk must be >= 1.2.3 <code></code> Installation instructions are here: https://github.com/shauntarves/wyze-sdk. If you cannot upgrade Python to 3.8, here are the steps to install wyze-sdk manually:
- Download the zipfile for wyze-sdk from github and unzip it locally.
- cd into wyze-sdk-master and edit setup.py, changing 3.8.0 to 3.7.3, and save file.
- Install it from the current directory: $ sudo pip3 install .

## Caveats

This plugin was developed and proved-in on a Rpi 4 running the latest version of Raspbian Linux (5.10.63-v7l+ #1496), and HomeBridge with the homebridge-ui-x plugin. If you are running in ANY other environment (Windows, Mac OS, Docker, Home Assistant, Synergy NAS, etc.) and have any issues with installation and or running, you are on your own. If you are successful in alternate environments I welcome your feedback so I can document it here.

If you have multiple vacuums (one for each floor of your house) you should create a different 'Vacuum' room in the Home app to represent each floor (ex: First Flooor Vacuum, Second Floor Vacuum, etc.) and then move the accessories for each vacuum into the appropriate room. This will make things easier to manage.

You can only ask to sweep one room at a time (or All Rooms) for a particular vacuum. Only one 'switch' can be on at a time for the same device.

The statusCheckRefreshInterval indicates how often to check that the vacuum is still sweeping after being started. When the vacuum stops sweeping the associated switch icon will be turned off. This means it could take up to 30 seconds (default) for the icon to indicate the vacuum is done. Wyze servers start ignoring requests if you poll them too often. After starting the plugin, it will take batteryCheckRefreshInterval (2 min default) to see the battery charge level the first time. After that the value is refreshed after each interval.  

From the time a room switch is 'pressed', it takes 10-15 seconds for the vacuum to activate.

### Error Indications

The Wyze API indicates the vacuum is sweeping but does not return any 'room' information. If the vacuum was already started sweeping by the Wyze app when you try to start it via the plugin, nothing will happen. The switch will just turn itself off. I don't like it either but that's how it works now.

If you start the vacuum sweeping and then try to turn on a different room 'switch' (i.e. - pick a different room), the second switch will turn off with an '!' in the icon, indicating the error. To change rooms, first turn off the room that's being swept.

## Configuration

Use the settings UI in Homebridge Config UI X to configure your Wyze account, or manually add the following to the platforms section of your config file:

```js
{
  "platforms": [
    {
      "platform": "WyzeRoboVac",
      "name": "WyzeRoboVac",
      "username": "YOUR_EMAIL",
      "password": "YOUR_PASSWORD",
      "mfaCode": "YOUR_2FA_AUTHENTICATION_PIN",
      "statusCheckRefreshInterval": "Refresh Interval for status checks after sweeping starts. Default 30000mS (30 sec)",
      "batteryCheckRefreshInterval": "Refresh Interval for battery checks. Default 120000mS (2 min)",
      "path2py_stubs": "Path to Python helper scripts. Default '/usr/lib/node_modules/homebridge-wyze-robovac/py_helpers'",
      "debugLevel": "Can be 0 (no logging), 1 (log.info), or 2 (log.debug)"
    }
  ]
}
```

Supported devices will be discovered and added to Homebridge automatically.

### Optional fields

* **`mfaCode`** &ndash; Only required for the initial login if you have two-factor authentication enabled for your account. This is typically a 6-digit code provided by your authenticator app.
* **`statusCheckRefreshInterval`** &ndash; Defines how often the status of the vacuum will be polled in milliseconds after sweeping has started (e.g., `"statusCheckRefreshInterval": 60000` will check the status of your devices' status every 60 seconds). Defaults to 30000 ms (30 seconds).
* **`batteryCheckRefreshInterval`** &ndash; Defines how often the battery level of the vacuum will be polled in milliseconds (e.g., `"batteryCheckRefreshInterval": 60000` will check the status of your devices' status every 60 seconds). Defaults to 120000 ms (2 minutes).

## Other Info

Special thanks to the following projects for reference and inspiration:

- [wyze-sdk](https://github.com/shauntarves/wyze-sdk), a Python library for controlling the Wyze Robot Vacuum and other Wyze products.
- [homebridge-plugin-template](https://github.com/homebridge/homebridge-plugin-template), a Dynamic Platform example.

Thanks to again [shauntarves](https://github.com/shauntarves/wyze-sdk) for the Python libraries that this plugin utilizes, and thanks to others for volunteering their time to help fix bugs and add support for other features.
