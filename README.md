# <img src="matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;matterbridge-wyze-robovac

[![npm](https://img.shields.io/npm/v/matterbridge-wyze-robovac)](https://www.npmjs.com/package/matterbridge-wyze-robovac/v/latest)
[![npm](https://img.shields.io/npm/dt/matterbridge-wyze-robovac)](https://www.npmjs.com/package/matterbridge-wyze-robovac)
[![GitHub last commit](https://img.shields.io/github/last-commit/RMCob/matterbridge-wyze-robovac)](https://github.com/RMCob/matterbridge-wyze-robovac)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue)](https://www.paypal.com/donate/?business=G63Z63BWAJWZN&no_recurring=0&currency_code=USD)

---

Matterbridge plugin to control and report status of the Wyze S200 Robot Vacuum

A Robot Vacuum Cleaner device (supported by SmartThings, Alexa, Home Assistant and partially by Apple Home). Read also https://github.com/Luligu/matterbridge/discussions/264.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/rmcob/matterbridge-wyze-robovac and sponsoring it.

## Requirements

Python version must be >= 3.11.2.

wyze-sdk version must be >= 2.2.0. Installation instructions are [here](https://github.com/shauntarves/wyze-sdk).

matterbridge version must be >= 3.3.6 Installation instructions are [here](https://github.com/Luligu/matterbridge/blob/main/README.md).

Visit the Wyze developer API portal to generate an API ID/KEY: **https://developer-api-console.wyze.com/#/apikey/view**.
This info is used in the Matterbridge Config settings for this plugin. See the **`Configuration`** section below. Be careful to check that the generated keys do not contain any 'shell' special characters like '*' or '|' (vertical bar). If they do, delete the keys (via the web browser interface) and regenerate them.

## Caveats

- This plugin was developed and proved-in on a RPi 5 running the latest versions of Raspbian Linux (6.12.47+rpt-rpi-2712), and Matterbridge (3.3.6) running in 'bridge' mode. If you are running in ANY other environment (Windows, Mac OS, Docker, Home Assistant, Synergy NAS, etc.) and have any issues with installation and or running, you are on your own. If you are successful in alternate environments I welcome your feedback so I can document it here.

- If you have multiple vacuums you will need to run multiple instances of Matterbridge, one per vacuums, whitelisting each vacuum to a particular instance. Since I only have one vacuum this situation has never been tested.

- The plugin only reads the room list once when it starts. If you re-map your floorplan with the Wyze app, the plugin must be restarted.

- If you start sweeping a room that is on a different floor than the 'current' floor shown in the Wyze app, the plugin will cause the map shown in the app to change to the floor the room being swept is on.

- The statusCheckRefreshInterval indicates how often to check that the vacuum is still sweeping after being started. Wyze servers start ignoring requests if you poll them too often. This will cause the **`py_helpers`** scripts to fail and the plugin will get out of sync with the vacuum. If that happens, use the Wyze app to send the vacuum back to the dock and they should re-sync after it docks.

- If **\*Entire Floor\*** is selected in the list of rooms to be cleaned it will override any other room selection. In this context, selecting "Entire Floor" in the plugin UI is the same as using the Wyze app and not selecting any specific rooms, which indicates that the entire floor should be swept.
- From the time a room cleaning is requested, it takes 10-15 seconds for the vacuum to activate.

## Configuration

Use the settings UI in Matterbridge browser interface to configure your Wyze account information, or manually add the following to the platforms section of your config file. See the **`Requirements`** section above for instructions on how to get your API_KEY and KEY_ID:

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
      "statusCheckRefreshInterval": "Refresh Interval for status checks after sweeping starts. Default 45 sec",
      "idleStatusCheck1RefreshInterval": "Refresh Interval for battery checks when idle. Default 1800 seconds (30 min)",
      "idleStatusCheck2RefreshInterval": "Refresh Interval for battery checks when busy or charge level < 100. Default 120 seconds (2 min)",
      "path2py_stubs": "Path to Python helper scripts. Default '/usr/lib/node_modules/matterbridge-wyze-robovac/py_helpers'",
      "debugLevel": "Can be 0 (no logging), 1 (log.info), or 2 (log.debug)"
    }
  ]
}
```

### Optional fields

* **`mfaCode`** &ndash; Only required for the initial login if you have two-factor authentication enabled for your account. This is typically a 6-digit code provided by your authenticator app.
* **`statusCheckRefreshInterval`** &ndash; Defines how often the status of the vacuum will be polled in seconds after sweeping has started (e.g., `"statusCheckRefreshInterval": 60` will check your devices' status every 60 seconds). Defaults to 30 seconds.
* **`idleStatusCheck1RefreshInterval`** &ndash; Defines how often to check the battery level of the vacuum when it is idle and the battery level = 100. (e.g., `"idleBatteryCheckRefreshInterval": 2700` will check the battery level every 45 minutes. Defaults to 1800 seconds (30 minutes).
* **`idleStatusCheck2RefreshInterval`** &ndash; Defines how often to check the battery level of the vacuum when it is busy or the battery level < 100. (e.g., `"busyBatteryCheckRefreshInterval": 60` will check the battery level every minute. Defaults to 120 seconds (2 minutes).

## To Do

- The Manufacturer name, model number, and firnware version need to be set on the **`Info`** page of the UI.

- There is no error reporting if the vacuum gets stuck or lost, dust bin removed, etc.

## Other Info

Special thanks to the following projects for reference and inspiration:

- [wyze-sdk](https://github.com/shauntarves/wyze-sdk), a Python library for controlling the Wyze Robot Vacuum and other Wyze products.
- [matterbridge-dynamic-plugin-example](https://github.com/Luligu/matterbridge-example-dynamic-platform).

Thanks again to [Shaun Tarves](https://github.com/shauntarves/wyze-sdk) for the Python libraries that this plugin utilizes, [Luligu](https://github.com/Luligu/matterbridge) for Matterbridge, and thanks to others for volunteering their time to help fix bugs and add support for other features.

