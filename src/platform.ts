import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { VacuumRoom } from './platformAccessory';

/* eslint-disable */
/* lint doesn't like this line. Not sure why */
const { exec } = require('child_process');
/* eslint-enable */

const currentRoomName : string[] = [];
const nickNames : string[] = [];

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
    if ( this.config.name === undefined || this.config.username === undefined || this.config.password === undefined ) {
      log.error('INVALID CONFIGURATION FOR PLUGIN: homebridge-wyze-robovac');
      log.error('name, username and/or password not set. Plugin not started.');
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
    currentRoomName[ nickNames.indexOf(nickName) ] = roomName;
  }

  discoverDevices() {
    //
    // Make list of nicknames for each vacuum.
    //
    this.myLogger(`discoverDevices(): username = '${this.config.username}', password = '${this.config.password}'`);
    exec(`python3 ${this.config.path2py_stubs}/getVacuumDeviceList.py ${this.config.username} ${this.config.password}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          //return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          //return;
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
    exec(`python3 ${this.config.path2py_stubs}/getVacuumRoomList.py ${this.config.username} ${this.config.password} ${nickName}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          //return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          //return;
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

          // generate a unique id for the accessory this should be generated from
          // something globally unique, but constant, for example, the device serial
          // number or MAC address.
          const uuid = this.api.hap.uuid.generate(nickName + room);

          // see if an accessory with the same uuid has already been registered and restored from
          // the cached devices we stored in the `configureAccessory` method above
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            // the accessory already exists
            this.log.info(`Restoring existing accessory from cache: '${existingAccessory.displayName}' for vacuum '${nickName}'`);

            // create the accessory handler for the restored accessory
            // this is imported from `platformAccessory.ts`
            new VacuumRoom(this, existingAccessory, nickName);

          } else {
            // the accessory does not yet exist, so we need to create it
            this.log.info(`Adding new accessory '${room}' for vacuum '${nickName}'`);

            // create a new accessory
            const accessory = new this.api.platformAccessory(room, uuid);

            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            new VacuumRoom(this, accessory, nickName);

            // link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
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
