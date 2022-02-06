import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WyzeRoboVac } from './platform';

/* eslint-disable */
const { exec } = require('child_process');
/* eslint-enable */

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 */
export class VacuumRoom {
  private service: Service;
  private isOn = false;
  private currentStatus = '';
  private accLogName = '';
  private p2stubs = this.robovac.config.path2py_stubs;
  private username = this.robovac.config.username;

  constructor(
    private readonly robovac: WyzeRoboVac,
    private readonly accessory: PlatformAccessory,
    private readonly deviceNickname: string,
  ) {

    // set accessory information
    this.accessory.getService(this.robovac.Service.AccessoryInformation)!
      .setCharacteristic(this.robovac.Characteristic.Manufacturer, 'Wyze')
      .setCharacteristic(this.robovac.Characteristic.Model, 'RoboVac')
      .setCharacteristic(this.robovac.Characteristic.SerialNumber, 'Default-Serial');

    // get the Switch service if it exists, otherwise create a new Switch service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.robovac.Service.Switch) || this.accessory.addService(this.robovac.Service.Switch);

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.robovac.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Switch.
   */
  async setOn(value: CharacteristicValue) {

    this.isOn = value as boolean;

    const currentlySweeping = this.robovac.getCurrentRoomName( this.deviceNickname );
    this.accLogName = `'${this.accessory.displayName}'(${this.deviceNickname})`;

    this.myLogger(`Room '${this.accessory.displayName}'(${this.deviceNickname}): Set Characteristic On -> '${this.isOn}'`);

    if( this.isOn ) {
      if( currentlySweeping === '' ) { // Check that the vacuum is really idle

        exec(`python3 ${this.p2stubs}/getVacuumStatus.py ${this.username} ${this.robovac.config.password} ${this.deviceNickname}`,
          (error, stdout, stderr) => {
            if (error) {
              this.robovac.log.info(`error: ${error.message}`);
              //return;
            }
            if (stderr) {
              this.robovac.log.info(`stderr: ${stderr}`);
              //return;
            }

            this.currentStatus = stdout.slice(0, -1);  // Strip off trailing newline ('\n')

            this.myLogger(`Room ${this.accLogName}): vacuumStatus = '${this.currentStatus}'`);

            if( this.currentStatus === 'VacuumMode.SWEEPING' ) {
              //
              // Abort this request
              //
              // Just turn the switch icon off.  Throwing an error here causes the entire plugin to go belly up. Not sure why.
              //
              this.myLogger(`Aborting request for room ${this.accLogName}. vacuumStatus = '${this.currentStatus}'`);
              this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false);
              //throw new this.robovac.api.hap.HapStatusError(this.robovac.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
              return;
            }

            //
            // Check if the vacuum is already sweeping a different room
            //
            this.myLogger(`currentlySweeping = '${currentlySweeping}', accessory.displayName = '${this.accessory.displayName}'`);
            if( currentlySweeping !== '' && currentlySweeping !== this.accessory.displayName ) {
              // Abort this request
              this.myLogger(`Aborting request for room ${this.accLogName}. Already sweeping '${currentlySweeping}'`);
              this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false);
              //
              // Throwing the error forces the switch icon off with a "!" displayed to indicate an error
              //
              throw new this.robovac.api.hap.HapStatusError(this.robovac.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
              return;
            }
            this.myLogger(`Room ${this.accLogName} turning 'On'`);
            this.runVacuum( this.isOn, this.accessory.displayName );
          });
      } else {
        if( currentlySweeping === this.accessory.displayName ) { // This case should not be possible, but just in case :-)
          this.myLogger(`Room ${this.accLogName}: got setOn(true) event when suposedly already on. Ignoring...`);
          return;
        } else {
          // Currently sweeping some other room. Abort this request
          this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false);
          //
          // Throwing the error forces the switch icon off with a "!" displayed to indicate an error
          //
          this.myLogger(`Aborting request for room ${this.accLogName}. Already sweeping '${currentlySweeping}'`);
          throw new this.robovac.api.hap.HapStatusError(this.robovac.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
          return;
        }
        return;
      }
    } else {  // this.isOn == false
      if( currentlySweeping === this.accessory.displayName ) {
        this.myLogger(`Room ${this.accLogName} turning 'Off'`);
        this.runVacuum( this.isOn, this.accessory.displayName );
        return;
      } else {
        // Currently sweeping some other room. Abort this request
        this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false);
        //
        // Throwing the error forces the switch icon off with a "!" displayed to indicate an error
        //
        this.myLogger(`Aborting request for room ${this.accLogName}. Already sweeping '${currentlySweeping}'`);
        throw new this.robovac.api.hap.HapStatusError(this.robovac.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        return;
      }
    }
  }

  runVacuum( isOn, room ) {
    let roomName = room;
    let py_prog = '';
    let intervalID;
    let isSweeping = false;

    if(isOn) {
      this.robovac.setCurrentRoomName( roomName, this.deviceNickname );
      this.robovac.log.info(`Starting to sweep room '${roomName}'(${this.deviceNickname})`);
      py_prog = 'vacuumStartSweep';
      //
      // Start loop to check vacuum status
      //
      intervalID = setInterval(() => {
        exec(`python3 ${this.p2stubs}/getVacuumStatus.py ${this.username} ${this.robovac.config.password} ${this.deviceNickname}`,
          (error, stdout, stderr) => {
            if (error) {
              this.robovac.log.info(`error: ${error.message}`);
              //return;
            }
            if (stderr) {
              this.robovac.log.info(`stderr: ${stderr}`);
              //return;
            }

            this.currentStatus = stdout.slice(0, -1);  // Strip off trailing newline ('\n')

            this.myLogger(`in setInterval(), this.currentStatus = '${this.currentStatus}'`);
            if( isSweeping ) {    // Waiting for vacuum to finish
              if( this.currentStatus !== 'VacuumMode.SWEEPING' ) {
                isSweeping = false;
                clearInterval( intervalID );  // Stop checking.
                this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false); // Turn the switch icon off
              }
            } else {              // Waiting for vacuum to start
              if( this.currentStatus === 'VacuumMode.SWEEPING' ) {
                isSweeping = true;
              }
            }
          });
      }, this.robovac.config.refreshInterval);
    } else {
      this.robovac.setCurrentRoomName( '', this.deviceNickname );
      this.robovac.log.info(`Stopping sweep of room '${roomName}'(${this.deviceNickname}). Returning to charge...`);
      py_prog = 'vacuumStopSweep';
      roomName = '';
      clearInterval( intervalID );
    }

    exec(`python3 ${this.p2stubs}/${py_prog}.py ${this.username} ${this.robovac.config.password} ${this.deviceNickname} '${roomName}'`,
      (error, stdout, stderr) => {
        if (error) {
          this.robovac.log.info(`error: ${error.message}`);
          //return;
        }
        if (stderr) {
          this.robovac.log.info(`stderr: ${stderr}`);
          //return;
        }
        this.myLogger(`stdout: ${stdout.slice(0, -1)}`); // Strip off trailing newline ('\n')
      });
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   */
  async getOn(): Promise<CharacteristicValue> {
    let isOn = false;

    const currentlySweeping = this.robovac.getCurrentRoomName( this.deviceNickname );
    if( currentlySweeping === this.accessory.displayName ) {
      isOn = true;
    } else {
      isOn = false;
      this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false);
    }
    this.myLogger(`Room '${this.accessory.displayName}'(${this.deviceNickname}): Get Characteristic On -> ${isOn}`);

    return isOn;
  }

  myLogger( line ) {
    switch( this.robovac.config.debugLevel ) {
      case 0:   // No logging
        return;
        break;
      case 1:   // Logging to homebridge.log
        this.robovac.log.info( line );
        break;
      case 2:   // Logging to system level logs.
        this.robovac.log.debug( line );
        break;
      default:
    }
  }
}
