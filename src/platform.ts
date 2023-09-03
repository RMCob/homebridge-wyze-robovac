import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VacuumRoom, BatteryLevel, stopSleep } from './platformAccessory';

/* eslint-disable */
/* lint doesn't like this line. Not sure why */
const { exec } = require('child_process');
/* eslint-enable */

const batteryAccessory :PlatformAccessory[] = [];
const currentRoomName : string[] = [];
const nickNames : string[] = [];
const floorName = '';

export class WyzeRoboVac implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // Validate configuration
    if ( this.config.name === undefined || this.config.username === undefined ||
         this.config.password === undefined || this.config.key_id === undefined ||
         this.config.api_key === undefined ) {
      log.error('INVALID CONFIGURATION FOR PLUGIN: homebridge-wyze-robovac');
      log.error('name, username, password, key_id and/or api_key not set. Plugin not started.');
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info(`Loading accessory from cache: '${accessory.displayName}'`);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  getCurrentRoomName( nickName ) {
    return( currentRoomName[ nickNames.indexOf(nickName) ] );
  }

  setCurrentRoomName( roomName, nickName ) {
    currentRoomName[ nickNames.indexOf(nickName) ] = roomName; // != "" ==> sweeping. Otherwise not sweeping
    this.myLogger('BatteryLevel: stopping current sleep');
    stopSleep(); // Restart battery level survailance.
  }

  discoverDevices() {
    //
    // Make list of nicknames for each vacuum.
    //
    this.myLogger(`discoverDevices(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`discoverDevices(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}'`);
    const tmpstr = `${this.config.username} ${this.config.password} ${this.config.key_id}  ${this.config.api_key}`;
    exec(`python3 ${this.config.path2py_stubs}/getVacuumDeviceList.py ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          return;
        }
        let line = '';

        // Get individual lines of output from stdout
        for(let i = 0; i < stdout.length; i++) {
          const c = stdout.charAt(i);
          if( c === '\n') {
            nickNames.push( line );
            currentRoomName.push( '' );   // Current room name for this vacuum
            line = '';
            continue;
          }
          line = line.concat( stdout.charAt(i) );
        }

        // loop over the discovered devices and find the rooms for each vacuum
        for (const nickName of nickNames) {
          this.discoverRooms( nickName );
        }
      });
  }

  discoverRooms(nickName) {
    const rooms : string[] = [];
    //
    // Get list of rooms from Wyze from the current map for this device
    //
    const tmpstr = `${this.config.password} ${this.config.key_id} ${this.config.api_key} '${nickName}'`;
    exec(`python3 ${this.config.path2py_stubs}/getVacuumFloors.py ${this.config.username} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          return;
        }
        let line = '';

        // Get individual lines of output from stdout
        for(let i = 0; i < stdout.length; i++) {
          const c = stdout.charAt(i);
          if( c === '\n') {
            rooms.push( line );
            line = '';
            continue;
          }
          line = line.concat( stdout.charAt(i) );
        }
        this.myLogger(`in discoverRooms(): rooms.length: ${rooms.length}`);

        // loop over the discovered rooms and register each one if it has not already been registered
        for (const room of rooms) {
          const tmpList = room.split(':');
          const roomName = room;
          const floorName = tmpList[1];

          // generate a unique id for the accessory this should be generated from
          // something globally unique, but constant, for example, the device serial
          // number or MAC address.
          const uuid = this.api.hap.uuid.generate(nickName + roomName + floorName);

          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          const tmpStr = `for vacuum '${nickName}'`;
          if (existingAccessory) {
            // the accessory already exists
            this.log.info(`Restoring existing accessory from cache: '${existingAccessory.displayName}'` + tmpStr);

            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            new VacuumRoom(this, existingAccessory, nickName, floorName);

          } else {
            // the accessory does not yet exist, so we need to create it
            this.log.info(`Adding new accessory '${roomName}'` + tmpStr);

            // create a new accessory
            const accessory = new this.api.platformAccessory(roomName, uuid);

            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            new VacuumRoom(this, accessory, nickName, floorName);

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }

        //
        // Create a Humidity Sensor accessory to represent the device's current charge level (0-100)
        //
        // generate a unique id for the accessory this should be generated from
        // something globally unique, but constant, for example, the device serial
        // number or MAC address.
        const uuid = this.api.hap.uuid.generate(nickName + floorName + 'BateryLevel');

        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          batteryAccessory.push(existingAccessory);
          // the accessory already exists
          this.log.info(`Restoring existing accessory from cache: '${existingAccessory.displayName}' for vacuum '${nickName}'`);

          // create the accessory handler for the restored accessory
          // this is imported from `platformAccessory.ts`
          new BatteryLevel(this, existingAccessory, nickName, floorName);

        } else {
          // the accessory does not yet exist, so we need to create it
          this.log.info(`Adding new accessory 'BatteryLevel' for vacuum '${nickName}'`);

          // create a new accessory
          const accessory = new this.api.platformAccessory(`BatteryLevel(${nickName})`, uuid);
          batteryAccessory.push(accessory);

          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          new BatteryLevel(this, accessory, nickName, floorName);

          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      });
  }

  myLogger( line ) {
    switch( this.config.debugLevel ) {
      case 0:   // No logging
        return;
        break;
      case 1:   // Logging to homebridge.log
        this.log.info( line );
        break;
      case 2:   // Logging to system level logs.
        this.log.debug( line );
        break;
      default:
    }
  }
}
