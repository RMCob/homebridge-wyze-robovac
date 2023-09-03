import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { WyzeRoboVac } from './platform';

const sleep1 = t => new Promise(s => setTimeout(s, (t * 1000)));

/* eslint-disable */
const { exec } = require('child_process');
/* eslint-enable */

/**
 * Platform Accessory
 * An instance of this class is created for each room the platform registers
 */
export class VacuumRoom {
  private service: Service;
  private battery;
  private isOn = false;
  private currentStatus = '';
  private accLogName = '';
  private p2stubs = this.robovac.config.path2py_stubs;
  private username = this.robovac.config.username;

  constructor(
    private readonly robovac: WyzeRoboVac,
    private readonly accessory: PlatformAccessory,
    private readonly deviceNickname: string,
    private readonly floorName: string,
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

  /*
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

        const tmpstr = `${this.robovac.config.key_id} ${this.robovac.config.api_key} '${this.deviceNickname}'`;
        exec(`python3 ${this.p2stubs}/getVacuumStatus.py ${this.username} ${this.robovac.config.password} ${tmpstr}`,
          (error, stdout, stderr) => {
            if (error) {
              this.robovac.log.info(`error: ${error.message}`);
              return;
            }
            if (stderr) {
              this.robovac.log.info(`stderr: ${stderr}`);
              return;
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
            this.runVacuum( this.isOn, this.accessory.displayName, this.floorName );
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
        this.runVacuum( this.isOn, this.accessory.displayName, this.floorName );
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

  async runVacuum( isOn, room, floor ) {
    const roomName = room;
    const floorName = floor;
    let py_prog = '';
    let intervalID;
    let isSweeping = false;
    const tmpList = roomName.split(':');
    let room2sweep = tmpList[0];

    if(isOn) {
      // Make the map this room is in the 'current' map
      this.setCurrentFloorMap( floorName );

      await sleep1( 5 );
      this.robovac.setCurrentRoomName( roomName, this.deviceNickname );
      this.robovac.log.info(`Starting to sweep room '${roomName}'(${this.deviceNickname})`);
      py_prog = 'vacuumStartSweep';
      //
      // Start loop to check vacuum status
      //
      intervalID = setInterval(() => {
        const tmpstr = `${this.robovac.config.key_id} ${this.robovac.config.api_key} '${this.deviceNickname}'`;
        exec(`python3 ${this.p2stubs}/getVacuumStatus.py ${this.username} ${this.robovac.config.password} ${tmpstr}`,
          (error, stdout, stderr) => {
            if (error) {
              this.robovac.log.info(`error: ${error.message}`);
              return;
            }
            if (stderr) {
              this.robovac.log.info(`stderr: ${stderr}`);
              return;
            }

            this.currentStatus = stdout.slice(0, -1);  // Strip off trailing newline ('\n')

            this.myLogger(`in setInterval(), this.currentStatus = '${this.currentStatus}'`);
            if( isSweeping ) {    // Waiting for vacuum to finish
              if( this.currentStatus !== 'VacuumMode.SWEEPING' ) {
                isSweeping = false;
                clearInterval( intervalID );  // Stop checking.
                this.myLogger('in setInterval(): Clearing currentRoomName, turning switch icon off');
                this.robovac.setCurrentRoomName( '', this.deviceNickname );
                this.service.getCharacteristic(this.robovac.Characteristic.On).updateValue(false); // Turn the switch icon off
                this.robovac.log.info(`Finished sweeping room '${roomName}'(${this.deviceNickname})`);
              }
            } else {              // Waiting for vacuum to start
              if( this.currentStatus === 'VacuumMode.SWEEPING' ) {
                isSweeping = true;
              }
            }
          });
      }, (this.robovac.config.statusCheckRefreshInterval * 1000));
    } else {
      this.robovac.setCurrentRoomName( '', this.deviceNickname );
      this.robovac.log.info(`Stopping sweep of room '${roomName}'(${this.deviceNickname}). Returning to charge...`);
      py_prog = 'vacuumStopSweep';
      room2sweep = '';
      clearInterval( intervalID );
    }

    const tmpstr = `${this.robovac.config.key_id} ${this.robovac.config.api_key} '${this.deviceNickname}' '${room2sweep}'`;
    exec(`python3 ${this.p2stubs}/${py_prog}.py ${this.username} ${this.robovac.config.password}  ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.robovac.log.info(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          this.robovac.log.info(`stderr: ${stderr}`);
          return;
        }
        this.myLogger(`stdout: ${stdout.slice(0, -1)}`); // Strip off trailing newline ('\n')
      });
  }

  setCurrentFloorMap( floorName ) {
    const floor = floorName;
    const tmpstr1 = `${this.robovac.config.username} ${this.robovac.config.password}`;
    const tmpstr2 = `${this.robovac.config.key_id} ${this.robovac.config.api_key} '${this.deviceNickname}' '${floor}'`;
    exec(`python3 ${this.robovac.config.path2py_stubs}/setVacuumFloor.py ${tmpstr1} ${tmpstr2}`,
      (error, stdout, stderr) => {
        if (error) {
          this.robovac.log.info(`error: ${error.message}`);
        }
        if (stderr) {
          this.robovac.log.info(`stderr: ${stderr}`);
        }
        if (error || stderr) {
          return;
        }
        this.myLogger(`Current map set to floor '${floor}'`);
      },
    );
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

//
// Create Humidity Sensor accessory to represent cattery charge level
//

let myBatteryLevel;

export async function stopSleep() {
  myBatteryLevel.myLogger(`BatteryLevel(${myBatteryLevel.deviceNickname}): calling myBatteryLevel._stopSleep()`);
  await myBatteryLevel._stopSleep();
}

export class BatteryLevel {
  private service: Service;
  private currentBatteryLevel = 0;
  private lastValidBatteryLevel = 13;
  private state = 0;
  private getBatLvlFinished = false;
  private refreshInterval = 5; // 5 seconds
  private stopTimeout = false;
  private timeoutID;
  private timerFinished = false;
  private accLogName = '';
  private p2stubs = this.robovac.config.path2py_stubs;
  private username = this.robovac.config.username;

  constructor(
    private readonly robovac: WyzeRoboVac,
    private readonly accessory: PlatformAccessory,
    private readonly deviceNickname: string,
    private readonly floorName: string,
  ) {

    // eslint-disable-next-line  @typescript-eslint/no-this-alias
    myBatteryLevel = this;

    // set accessory information
    this.accessory.displayName = `BatteryLevel(${this.deviceNickname})`;
    this.accessory.getService(this.robovac.Service.AccessoryInformation)!
      .setCharacteristic(this.robovac.Characteristic.Manufacturer, 'Wyze')
      .setCharacteristic(this.robovac.Characteristic.Model, 'RoboVac')
      .setCharacteristic(this.robovac.Characteristic.SerialNumber, 'Default-Serial');

    // get the HumiditySensor service if it exists, otherwise create a new HumiditySensor service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.robovac.Service.HumiditySensor) || this.accessory.addService(this.robovac.Service.HumiditySensor);

    // register handler for get Characteristic
    this.service.getCharacteristic(this.robovac.Characteristic.CurrentRelativeHumidity)
      .onGet(this.handleCurrentRelativeHumidityGet.bind(this));

    this.startHere();
  }

  setTimerFinished() {
    myBatteryLevel.timerFinished = true;
  }

  async startHere() {

    const doThis = true;
    while( doThis ) {

      this.myLogger(`BatteryLevel(${this.deviceNickname}): before sleep(), refreshInterval = '${this.refreshInterval}'`);

      this.stopTimeout = false;
      this.timerFinished = false;
      this.timeoutID = setTimeout( this.setTimerFinished, (this.refreshInterval * 1000));
      this.myLogger(`BatteryLevel(${this.deviceNickname}): waiting for setTimeout to finish`);
      const doThis2 = true;
      while( doThis2 ) {     // Wait for setTimeout to finish
        if( this.timerFinished ) {
          this.myLogger(`BatteryLevel(${this.deviceNickname}): this.timerFinished = ${this.timerFinished}`);
          break;
        }
        if( this.stopTimeout ) {
          this.myLogger(`BatteryLevel(${this.deviceNickname}): this.stopTimeout = ${this.stopTimeout}`);
          clearTimeout( this.timeoutID );
          break;
        }
        await sleep1( 1 );
      }

      this.getBatLvlFinished = false;
      await this.getBatLvl();
      let cntr = 0;
      while( ! this.getBatLvlFinished ) {
        if( cntr++ > 10 ) {  // Wait up to 10 seconds for getBatLvl() to finish
          break;
        }
        await sleep1( 1 );
      }

      this.myLogger(`BatteryLevel(${this.deviceNickname}): this.currentBatteryLevel = '${this.currentBatteryLevel}'`);
      this.service.getCharacteristic(this.robovac.Characteristic.CurrentRelativeHumidity).updateValue(this.currentBatteryLevel);

      const idleBatteryCheck = this.robovac.config.idleBatteryCheckRefreshInterval;
      const busyBatteryCheck = this.robovac.config.busyBatteryCheckRefreshInterval;

      const nickName = this.deviceNickname;
      if( `${this.currentBatteryLevel}` === '100' ) {
        if( this.robovac.getCurrentRoomName( this.deviceNickname ) !== '' ) {  // Currently sweeping
          if( this.refreshInterval !== this.robovac.config.busyBatteryCheckRefreshInterval ) {
            this.myLogger(`BatteryLevel(${nickName}): changing refreshInterval from ${this.refreshInterval} to ${busyBatteryCheck}`);
          }
          this.refreshInterval = this.robovac.config.busyBatteryCheckRefreshInterval;
        } else {							       // Not currently sweeping
          if( this.refreshInterval !== this.robovac.config.idleBatteryCheckRefreshInterval ) {
            this.myLogger(`BatteryLevel(${nickName}): changing refreshInterval from ${this.refreshInterval} to ${idleBatteryCheck}`);
          }
          this.refreshInterval = this.robovac.config.idleBatteryCheckRefreshInterval;
        }
      } else {                                                                 // battery level < 100
        if( this.refreshInterval !== this.robovac.config.busyBatteryCheckRefreshInterval ) {
          this.myLogger(`BatteryLevel(${nickName}): changing refreshInterval from ${this.refreshInterval} to ${busyBatteryCheck}`);
        }
        this.refreshInterval = this.robovac.config.busyBatteryCheckRefreshInterval;
      }
    }
  }

  public async _stopSleep() {
    this.myLogger(`BatteryLevel(${this.deviceNickname}): stopping current sleep`);
    this.stopTimeout = true;
    this.myLogger(`BatteryLevel(${this.deviceNickname}): sleep cleared`);
  }

  async getBatLvl() {
    const tmpstr = `${this.robovac.config.password} ${this.robovac.config.key_id} ${this.robovac.config.api_key} '${this.deviceNickname}'`;
    await exec(`python3 ${this.p2stubs}/getVacuumBatLevel.py ${this.username} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.robovac.log.info(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          this.robovac.log.info(`stderr: ${stderr}`);
          return;
        }

        this.currentBatteryLevel = stdout.slice(0, -1);  // Strip off trailing newline ('\n')
        if( isNaN(this.currentBatteryLevel) ) {
          this.robovac.log.info(`getVacuumBatLevel.py returned NaN, setting currentBatteryLevel to '${this.lastValidBatteryLevel}'`);
          this.currentBatteryLevel = this.lastValidBatteryLevel;
        } else {
          this.lastValidBatteryLevel = this.currentBatteryLevel;
        }

        this.getBatLvlFinished = true;
      });
  }

  handleCurrentRelativeHumidityGet() {
    this.myLogger(`BatteryLevel(${this.deviceNickname}): Triggered GET CurrentRelativeHumidity`);
    return this.currentBatteryLevel;
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
