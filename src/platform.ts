/**
 * This file contains the class RoboVacMatterbridgeDynamicPlatform.
 *
 * @file platform.ts
 * @author Rob Coben
 * @version 0.0.5
 * @license Apache-2.0
 *
 * Copyright 2025, 2026 Rob Coben
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Matterbridge, MatterbridgeEndpoint, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import { RoboticVacuumCleaner } from 'matterbridge/devices';
// import { isValidBoolean, isValidNumber } from 'matterbridge/utils';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AreaNamespaceTag } from 'matterbridge/matter';
// import { BooleanState, OnOff, LevelControl, } from 'matterbridge/matter/clusters';
import { RvcRunMode, PowerSource, ServiceArea, RvcOperationalState, RvcCleanMode } from 'matterbridge/matter/clusters';
import {exec} from 'child_process';
import { setTimeout } from 'timers/promises';
// import { BasicInformationServer, BridgedDeviceBasicInformationServer } from 'matterbridge/matter/behaviors';


export class RoboVacMatterbridgeDynamicPlatform extends MatterbridgeDynamicPlatform {

  private discoverDevicesFinished = false;
  private getCurrentStatusFinished = false;
  private getRoomsFinished = false;
  private startSweepFinished = false;
  private startCleanFinished = false;
  private stopSweepFinished = false;
  private pauseSweepFinished = false;
  private continueSweepFinished = false;
  private setFloorFinished = false;

  private nickname : string = 'RoboVac';
  private macAddr : string = '';
  private currentStatus : string = '';
  private oldStatus : string = '';
  private currentFloorName : string = '';
  private batteryLevel : number = 0;
  private batteryWasCharging : boolean = false;
  private rooms: string[] = [];
  private supportedMaps : { mapId: number; name: string; }[] = [];
  private supportedAreas: { areaId: number, mapId: number,
                            areaInfo: { locationInfo: { locationName: string, floorNumber: number, areaType: null },
                                        landmarkInfo: null } }[] = [];

  private selectedAreas : number[] = [];
  private currentMapId : number = -1;
  private isDocked = true;
  private errorCode : string = 'None';
  private newRoomsSelected : boolean = false;

  private pokeStatusLoop : boolean = false;
  private statusRefreshInterval : number = 0;
  private oldRefreshInterval : number = 0;

  private roboticVacuum: MatterbridgeEndpoint | undefined;

  bridgedDevices = new Map<string, MatterbridgeEndpoint>();

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function'
                                                     || !this.verifyMatterbridgeVersion('3.3.3')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.3.3".
         Please update Matterbridge from ${this.matterbridge.matterbridgeVersion}
         to the latest version in the frontend.`,
      );
    }

    this.log.info('Initializing platform:', this.config.name);
    if (config.whiteList === undefined) {
      config.whiteList = [];
    }
    if (config.blackList === undefined) {
      config.blackList = [];
    }
    if (config.enableRVC !== undefined) {
      delete config.enableRVC;
    }
    if (config.enableServerRvc === undefined) {
      config.enableServerRvc = true;
    }
  }

  override async onStart(reason: string) {
    let out : string = '';
    if( reason ) {
      out = reason;
    } else {
      out = 'none';
    }
    this.myLogger(`onStart - RoboVac called with reason = '${out}'`);

    // Wait for the platform to start
    await this.ready;
    await this.clearSelect();

    await this.findDevices();   // Get nickname for vacuum
    this.myLogger(`After findDevices(), this.nickname = '${this.nickname}'`);

    await this.getRoomList();

    // *********************** Create a vacuum *****************************
    /*
    The RVC is supported correctly by the Home app (all commands work).

    The bad news is that right now the Apple Home app only shows the RVC as a single device (not bridged)
    or a single device in the bridge.

    If the RVC is in a bridge with other devices, the whole Home app crashes... so don't try it.
    If your controller is Apple Home use server mode for the RVC.
    */
    this.roboticVacuum = new RoboticVacuumCleaner(
      'Robot Vacuum',
      this.macAddr,
      this.config.enableServerRvc === true ? 'server' : undefined,
      1, // currentRunMode
      [
        { label: 'Idle', mode: 1, modeTags: [{ value: RvcRunMode.ModeTag.Idle }] },
        { label: 'Cleaning', mode: 2, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }] },
      ], // supportedRunModes
      1, // currentCleanMode
      [
        { label: 'Vacuum', mode: 1, modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }] },
      ], // supportedCleanModes
      null, // currentPhase
      null, // phaseList
      undefined, // operationalState
      undefined, // operationalStateList
      [
        {
          areaId: 1,
          mapId: 1,
          areaInfo: { locationInfo: { locationName: 'Living', floorNumber: 0, areaType: AreaNamespaceTag.LivingRoom.tag },
            landmarkInfo: null },
        },
      ], // supportedAreas
      [], // selectedAreas
      1, // currentArea
      [
        {
          mapId: 1,
          name: 'Ground floor',
        },
      ], // supportedMaps
    );

    //   createDefaultBridgedDeviceBasicInformationClusterServer(this.nickname, this.macAddr, 0xfff1, 'Wyze', 'MyToy');

    if (this.config.enableServerRvc === true) {
      this.log.notice('RVC is in server mode 44');
    }

    this.roboticVacuum.addCommandHandler('pause', async () => {
      this.log.info('\'pause\' handler called - RoboVac');
      await this.pauseSweeping();
    });

    this.roboticVacuum.addCommandHandler('resume', async () => {
      this.log.info('\'resume\' handler called - RoboVac');
      this.doSweeping();
    });

    this.roboticVacuum.addCommandHandler('goHome', async () => {
      this.log.info('\'goHome\' handler called - RoboVac');
      await this.stopSweeping();

      let doLoop : boolean = true;
      while( doLoop ) {  // Waiting for vacuum to reach the dock or pause
        for( let i = 0; i < this.statusRefreshInterval; i++ ) {
          if( this.currentStatus === 'VacuumMode.IDLE' || this.currentStatus === 'VacuumMode.PAUSED'
                                                      || this.currentStatus === 'VacuumMode.DOCKED_NOT_COMPLETE' ) {
            doLoop = false;
            break;
          }
          if( this.pokeStatusLoop ) {
            break;   // Something external poked here. Re-evaluate for statusRefreshInterval
          }
          await setTimeout(1000);
        }
        if( doLoop === false ) {
          break;
        }
      }
      this.pokeStatusLoop = true;
    });

    this.roboticVacuum.addCommandHandler('selectAreas', async ({ request }) => {
      const { newAreas } = request as ServiceArea.SelectAreasRequest;
      this.selectedAreas.length = 0; // Clear the array
      for (const area of newAreas) {
        this.selectedAreas.push( area );
      }
      this.newRoomsSelected = true;
      this.myLogger(`'selectAreas' handler called. Selected areas: ${this.selectedAreas?.join(', ')}`);
    });

    this.roboticVacuum.addCommandHandler('changeToMode', async ({ request }) => {
      this.myLogger(`'changeToMode' handler called - RoboVac. New mode = ${request.newMode}`); // 1 == Idle, 2 == Running
      if( request.newMode === 2 ) { // Start vacuuming or Resume if paused
        this.doSweeping();
      }
    });

    this.myLogger('before addDevice');
    this.roboticVacuum = await this.addDevice(this.roboticVacuum);
    /*
    if( this.roboticVacuum ) {
      this.roboticVacuum.createDefaultBasicInformationClusterServer(this.nickname,
        this.macAddr, 0xfff1, 'Wyze', 0x8000, 'Robot Vacuum Cleaner');
    }
*/

    this.setupSupportedAreas();   // rooms & floors as defined in the Wyze app.
    this.myLogger('after setupSupportedAreas');
    this.myLogger('debugStringify( this.supportedMaps ):');
    this.myLogger( debugStringify( this.supportedMaps));
    if( this.roboticVacuum ) {
      await this.roboticVacuum.updateAttribute(ServiceArea.Cluster.id, 'supportedMaps', this.supportedMaps, this.log);
      await this.roboticVacuum.updateAttribute(ServiceArea.Cluster.id, 'supportedAreas', this.supportedAreas, this.log);
    }

    this.pokeStatusLoop = false;
    this.startStatusLoop();
  }

  override async onConfigure() {
    await super.onConfigure();
    this.myLogger('onConfigure called - RoboVac');
    if( this.roboticVacuum ) {
      await this.roboticVacuum.setAttribute('BridgedDeviceBasicInformation', 'vendorName', 'RobsToy', this.log);
    }
    await this.getStatus();
  }

  override async onShutdown(reason?: string) {
    await super.onShutdown(reason);
    let out : string = '';
    if( reason ) {
      out = reason;
    } else {
      out = 'none';
    }
    this.myLogger(`onShutdown - RoboVac called with reason = '${out}'`);
  }

  async addDevice(device: MatterbridgeEndpoint): Promise<MatterbridgeEndpoint | undefined> {
    if (!device.serialNumber || !device.deviceName) {
      this.log.info( 'Device not added. serialNumber or deviceName not set.' );
      return;
    }
    this.setSelectDevice(device.serialNumber, device.deviceName, undefined, 'hub');
    if (this.validateDevice(device.deviceName)) {
      await this.registerDevice(device);
      this.bridgedDevices.set(device.deviceName, device);
      return device;
    } else {
      return undefined;
    }
  }

  // ========================= Wyze API interface `=============================================

  /***************** SetFloor **********************/

  async setFloor() {
    /*
     * Find the floor name
     */
    if( this.selectedAreas.length === 0 ) {
      this.currentMapId = 1;
    } else {               // All selected rooms will be on the same floor so use the first one.
      for (let j = 0; j < this.supportedAreas.length; j++) {
        if( this.selectedAreas[0] === this.supportedAreas[j].areaId ) {
          this.currentMapId = this.supportedAreas[j].mapId;
        }
      }
    }
    for (let i = 0; i < this.supportedMaps.length; i++) {
      if( this.currentMapId === this.supportedMaps[i].mapId) {
        this.currentFloorName = this.supportedMaps[i].name;
        this.myLogger(` in setFloor(): this.currentFloorName = '${this.currentFloorName}'`);
      }
    }
    /*
     * Change map in the Wyze app to the current floor
     */
    let cntr = 0;
    this.setFloorFinished = false;
    await this.setCurrentFloor( this.currentFloorName );
    this.myLogger('waiting for setCurrentFloor() to finish');
    while( ! this.setFloorFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for getCurrentStatus() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`SCF cntr = '${cntr}'`);
    }
    this.myLogger( 'at end of setCurrentFloor()' );
  }

  async setCurrentFloor( floorName : string ) {
    const floor = floorName;
    const tmpstr1 = `${this.config.username} ${this.config.password}`;
    const tmpstr2 = `${this.config.key_id} ${this.config.api_key} '${this.nickname}' '${floor}'`;
    await exec(`python3 ${this.config.path2py_stubs}/setVacuumFloor.py ${tmpstr1} ${tmpstr2}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
        }

        if (error || stderr) {
          this.setFloorFinished = true;
          return;
        }
        this.myLogger(`Current map set to floor '${floor}'`);
      },
    );
    this.setFloorFinished = true;
    return;
  }

  /***************** Clean **********************/

  async startCleaning() {          // This should only be called when resuming after a 'Pause'
    let cntr = 0;
    this.startCleanFinished = false;
    await this.vacuumStartClean( this.nickname );
    this.myLogger('waiting for vacuumStartClean() to finish');
    while( ! this.startCleanFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for vacuumStartClean() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`SS cntr = '${cntr}'`);
    }
    this.myLogger( 'at end of pauseSweeping()' );
  }

  async vacuumStartClean(nickname : string) {
    this.myLogger(`vacuumStartClean(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`vacuumStartClean(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}', nickname = '${nickname}'`);
    const tmpstr = `${this.config.key_id} ${this.config.api_key} '${nickname}'`;
    await exec(`python3 ${this.config.path2py_stubs}/vacuumStartClean.py ${this.config.username} ${this.config.password} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.startCleanFinished = true;
          return;
        }
        if (stderr) {
          this.myLogger(`stderr: ${stderr}`);
          if( stderr.includes('Robovac is docked') ) {
            if( this.roboticVacuum ) {
              this.log.info('Wanted to Resume cleaning but device is currently docked. Update the UI');
              this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.log); // Idle
              this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.Docked, this.log);
              this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
          }
          this.startCleanFinished = true;
          return;
        }

        this.startCleanFinished = true;
        return;
      });
  }

  /***************** Pause **********************/

  async pauseSweeping() {
    let cntr = 0;
    this.pauseSweepFinished = false;
    await this.vacuumPauseSweeping( this.nickname );
    this.myLogger('waiting for vacuumPauseSweeping() to finish');
    while( ! this.pauseSweepFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for vacuumPauseSweeping() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`SS cntr = '${cntr}'`);
    }
    this.myLogger('at end of pauseSweeping()' );
  }

  async vacuumPauseSweeping(nickname : string) {
    this.myLogger(`vacuumPauseSweep(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`vacuumPauseSweep(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}', nickname = '${nickname}'`);
    const tmpstr = `${this.config.key_id} ${this.config.api_key} '${nickname}'`;
    await exec(`python3 ${this.config.path2py_stubs}/vacuumPauseSweep.py ${this.config.username} ${this.config.password} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.pauseSweepFinished = true;
          return;
        }
        if (stderr) {
          this.myLogger(`stderr: ${stderr}`);
          if( stderr.includes('Robovac is docked') ) {
            if( this.roboticVacuum ) {
              this.log.info('Wanted to Pause but device is currently docked. Update the UI');
              this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.log); // Idle
              this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.Docked, this.log);
              this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
          }
          this.pauseSweepFinished = true;
          return;
        }

        this.pauseSweepFinished = true;
        return;
      });
  }

  /***************** StopSweep **********************/

  async stopSweeping() {
    let cntr = 0;
    this.stopSweepFinished = false;
    await this.vacuumStopSweeping( this.nickname );
    this.myLogger('waiting for vacuumStopSweeping() to finish');
    while( ! this.stopSweepFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for vacuumStopSweeping() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`SS cntr = '${cntr}'`);
    }
    this.myLogger('at end of stopSweeping()' );
  }

  async vacuumStopSweeping(nickname : string) {
    this.myLogger(`vacuumStopSweep(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`vacuumStopSweep(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}', nickname = '${nickname}'`);
    const tmpstr = `${this.config.key_id} ${this.config.api_key} '${nickname}'`;
    await exec(`python3 ${this.config.path2py_stubs}/vacuumStopSweep.py ${this.config.username} ${this.config.password} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.stopSweepFinished = true;
          return;
        }
        if (stderr) {
          this.myLogger(`stderr: ${stderr}`);
          if( stderr.includes('Robovac is already docked') ) {
            if( this.roboticVacuum ) {
              this.log.info('Wanted to Stop sweeping but device is already docked. Update the UI');
              this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.log); // Idle
              this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.Docked, this.log);
              this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
          }

          this.stopSweepFinished = true;
          return;
        }

        this.stopSweepFinished = true;
        return;
      });
  }

  /***************** StartSweep **********************/

  async startSweeping() {
    let cntr = 0;
    this.startSweepFinished = false;
    await this.vacuumStartSweeping( this.nickname, this.selectedAreas );
    this.myLogger('waiting for vacuumStartSweeping() to finish');
    while( ! this.startSweepFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for vacuumStartSweeping() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`VSS cntr = '${cntr}'`);
    }
    this.myLogger( 'at end of startSweeping()' );
  }

  async vacuumStartSweeping(nickname : string, rooms2sweep : number[]) {
    let roomNames = '';
    if( rooms2sweep.length > 0 ) {
      for (let i = 0; i < rooms2sweep.length; i++) {
        const areaId = rooms2sweep[i];
        this.myLogger(`before StartSweep, rooms2sweep[${i}] = '${areaId}'`);
        for (let j = 0; j < this.supportedAreas.length; j++) {
          const area = this.supportedAreas[j];
          if( area.areaId === areaId ) {
            const name : string = area.areaInfo.locationInfo.locationName;
            roomNames += '\'' + name + '\'' + ' ';
            this.myLogger(`roomNames = '${roomNames}'`);
          }
        }
      }
      this.log.info(`Rooms to be swept = '${roomNames}'`);
    }
    this.myLogger(`vacuunStartSweeping(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`vacuunStartSweeping(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}', nickname = '${nickname}'`);
    const tmpstr = `${this.config.key_id} ${this.config.api_key} '${nickname}' ${roomNames}`;
    await exec(`python3 ${this.config.path2py_stubs}/vacuumStartSweep.py ${this.config.username} ${this.config.password} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.startSweepFinished = true;
          return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          this.startSweepFinished = true;
          return;
        }

        this.myLogger(`in startSweeping(): rooms2sweep = '${rooms2sweep}'`);

        this.startSweepFinished = true;
        return;
      });
  }

  /***************** Status **********************/
  async getStatus() {
    let cntr = 0;
    this.getCurrentStatusFinished = false;
    await this.getCurrentStatus(this.nickname);
    this.myLogger('waiting for getCurrentStatus() to finish');
    while( ! this.getCurrentStatusFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for getCurrentStatus() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`GCS cntr = '${cntr}'`);
    }
    this.myLogger(`at end of getStatus(), this.currentStatus = '${this.currentStatus}'`);
    return this.statusRefreshInterval;
  }

  async getCurrentStatus(nickname : string) {
    this.currentStatus = '';
    this.myLogger(`getCurrentStatus(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`getCurrentStatus(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}', nickname = '${nickname}'`);
    const tmpstr = `${this.config.key_id} ${this.config.api_key} '${nickname}'`;
    await exec(`python3 ${this.config.path2py_stubs}/getVacuumStatus.py ${this.config.username} ${this.config.password} ${tmpstr}`,
      async (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.getCurrentStatusFinished = true;
          return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          this.getCurrentStatusFinished = true;
          return;
        }
        const line = stdout.slice(0, -1);  // Strip off trailing newline ('\n')
        this.myLogger(`Current status = '${line}'`);
        const fields = line.split( ':' );
        this.currentStatus = fields[0];
        this.batteryLevel = Number(fields[1]);
        this.isDocked = fields[2].toLowerCase() === 'true';
        this.errorCode = fields[3];
        this.myLogger(`in getCurrentStatus(): currentStatus = '${this.currentStatus}', batteryLevel = ${this.batteryLevel},
                      isDocked = ${this.isDocked}, errorCode = '${this.errorCode}'`);
        if( this.roboticVacuum !== undefined ) {
          /*
           *  Update battery status in UI
           */
          this.roboticVacuum.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', this.batteryLevel * 2, this.log);
          if( this.batteryLevel === 100 ) {
            this.roboticVacuum.updateAttribute(PowerSource.Cluster.id, 'batChargeState',
              PowerSource.BatChargeState.IsAtFullCharge, this.log);
            if( this.batteryWasCharging ) {
              this.batteryWasCharging = false;
              this.pokeStatusLoop = true;
            }
          } else {
            if( this.isDocked ) {
              this.roboticVacuum.updateAttribute(PowerSource.Cluster.id, 'batChargeState',
                PowerSource.BatChargeState.IsCharging, this.log);
              this.batteryWasCharging = true;
            } else {
              this.roboticVacuum.updateAttribute(PowerSource.Cluster.id, 'batChargeState',
                PowerSource.BatChargeState.IsNotCharging, this.log);
              this.batteryWasCharging = false;
            }
          }
        }
        /*
         * Update UI with current status
         */
        if( this.currentStatus !== this.oldStatus ) {
          this.oldStatus = this.currentStatus;
          if( this.currentStatus === 'VacuumMode.IDLE' ) {
            if( this.roboticVacuum ) {
              await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.log); // Idle
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.Docked, this.log);
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
            this.log.info( 'Sweeping completed.');

          } else if( this.currentStatus === 'VacuumMode.PAUSED' ) {
            if( this.roboticVacuum ) {
              await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 2, this.log); // Cleaning
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.Paused, this.log);
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
            this.log.info( 'Sweeping paused.');

          } else if( this.currentStatus === 'VacuumMode.DOCKED_NOT_COMPLETE' ) {
            if( this.roboticVacuum ) {
              this.log.info( 'Vacuum docked. Will resume after recharge to 60%' );
              await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 2, this.log); // Cleaning
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.Docked, this.log);
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
            this.log.info( 'Vacuum is docked. Will resume sweeping after recharge to 60%' );

          } else if( this.currentStatus === 'VacuumMode.FINISHED_RETURNING_TO_CHARGE' ||
                     this.currentStatus === 'VacuumMode.RETURNING_TO_CHARGE' ) {
            if( this.roboticVacuum ) {
              await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.log); // Idle
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
                RvcOperationalState.OperationalState.SeekingCharger, this.log);
              await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
                { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
            }
            this.log.info( 'Vacuum is returning to dock.');
          }
        }
        /*
         * Determine statusRefreshInterval
         */
        if( this.currentStatus !== 'VacuumMode.IDLE' ) {
          this.statusRefreshInterval = Number( this.config.busyStatusCheckRefreshInterval );  // Sweeping
        } else if( this.batteryLevel < 100 ) {
          this.statusRefreshInterval = Number( this.config.idleStatusCheck2RefreshInterval );  // Docked battery < 100% charge
        } else {
          this.statusRefreshInterval = Number( this.config.idleStatusCheck1RefreshInterval );  // Docked battery full charge
        }

        if( this.statusRefreshInterval !== this.oldRefreshInterval ) {
          this.log.info(`changing statusRefreshIinterval from ${this.oldRefreshInterval} to ${this.statusRefreshInterval} seconds.`);
          this.oldRefreshInterval = this.statusRefreshInterval;
        }
        this.getCurrentStatusFinished = true;
        return this.statusRefreshInterval;
      });
  }

  /***************** Find Devices **********************/

  async findDevices() {
    let cntr = 0;
    this.discoverDevicesFinished = false;
    await this.discoverDevices();
    this.myLogger('waiting for discoverDevices() to finish');
    while( ! this.discoverDevicesFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for discoverDevices() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`DD cntr = '${cntr}'`);
    }
  }

  async discoverDevices() {
    const nickNames : string[] = [];
    const macAddrs : string[] = [];
    this.nickname = ''
    //
    // Make list of nicknames for each vacuum.
    //
    this.myLogger(`discoverDevices(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`discoverDevices(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}'`);
    const tmpstr = `${this.config.username} ${this.config.password} ${this.config.key_id}  ${this.config.api_key}`;
    this.myLogger('Before exec getVacuumDeviceList.py');
    await exec(`python3 ${this.config.path2py_stubs}/getVacuumDeviceList.py ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.discoverDevicesFinished = true;
          return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          this.discoverDevicesFinished = true;
          return;
        }
        let line = '';

        // Get individual lines of output from stdout
        for(let i = 0; i < stdout.length; i++) {
          const c = stdout.charAt(i);
          if( c === '\n') {
            const fields = line.split(':');
            nickNames.push( fields[0] );
            macAddrs.push( fields[1] );
            line = '';
            continue;
          }
          line = line.concat( stdout.charAt(i) );
        }

        // loop over the discovered devices.
        this.myLogger(`nickNames.length = ${nickNames.length}`);
        for (let i = 0; i < nickNames.length; i++) {
          this.nickname = nickNames[i];
          this.macAddr = macAddrs[i];
          this.myLogger(`in discoverDevices(), Device nickname = '${this.nickname}' MAC addr = '${this.macAddr}'`);
        }
        this.discoverDevicesFinished = true;
        return;
      },
    );
  }

  /***************** Find supported areas (Rooms) **********************/

  async getRoomList() {
    let cntr = 0;
    this.getRoomsFinished = false;
    await this.getRooms(this.nickname);
    this.myLogger('waiting for getRooms() to finish');
    while( ! this.getRoomsFinished ) {
      if( cntr++ > 10 ) {  // Wait up to 10 seconds for getRooms() to finish
        break;
      }
      await setTimeout(1000);  // Delay 1 second
      this.myLogger(`GR cntr = '${cntr}'`);
    }
    this.myLogger(`at end of getRooms, this.Rooms.length() = '${this.rooms.length}'`);
  }

  async getRooms(nickname : string) {
    //
    // Get list of rooms from Wyze from the current map for this device
    //
    this.myLogger(`getRooms(): username = '${this.config.username}', password = '${this.config.password}'`);
    this.myLogger(`getRooms(): key_id = '${this.config.key_id}', api_key = '${this.config.api_key}', nickname = '${nickname}'`);
    const tmpstr = `${this.config.password} ${this.config.key_id} ${this.config.api_key} '${nickname}'`;
    await exec(`python3 ${this.config.path2py_stubs}/getVacuumFloors.py ${this.config.username} ${tmpstr}`,
      (error, stdout, stderr) => {
        if (error) {
          this.log.info(`error: ${error.message}`);
          this.getRoomsFinished = true;
          return;
        }
        if (stderr) {
          this.log.info(`stderr: ${stderr}`);
          this.getRoomsFinished = true;
          return;
        }
        let line = '';
        // Get individual lines of output from stdout
        for (let i = 0; i < stdout.length; i++) {
          const c = stdout.charAt(i);
          if (c === '\n') {
            this.rooms.push(line);
            this.myLogger(`room = '${line}'`);
            line = '';
            continue;
          }
          line = line.concat(stdout.charAt(i));
        }
        this.myLogger(`in discoverRooms(): this.rooms.length: ${this.rooms.length}`);
        this.getRoomsFinished = true;
        return;
      });
  }

  // =========================== Utilities ===================================

  myLogger( line : string ) {
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

  setupSupportedAreas() {
    let floorCntr = 0;
    let roomCntr = 0;
    let saveFloorName = '';

    for (const room of this.rooms) {
      roomCntr++;
      const tmpList = room.split(':');
      const roomName = tmpList[0];;
      const floorName = tmpList[1];
      if( floorName !== saveFloorName ) {
        saveFloorName = floorName;
        floorCntr++;
        this.myLogger(`in setupSupportedAreas(); floorName[${floorCntr}] = '${floorName}'`);
        this.supportedMaps.push( this.floorMapEntry( floorCntr, floorName ));
      }
      this.myLogger(`in setupSupportedAreas(); roomName = '${roomName}'`);
      this.supportedAreas.push( this.supportedAreaEntry( roomCntr, floorCntr, roomName ));
    }
  }

  floorMapEntry( floorNum : number, floorName : string ) {
    return {
      mapId: floorNum,
      name: floorName,
    }
  }

  supportedAreaEntry( roomNum : number, floorNum: number, roomName : string ) {
    return {
      areaId: roomNum,
      mapId: floorNum,
      areaInfo: {
        locationInfo: {
          locationName: roomName,
          floorNumber: floorNum - 1,
          areaType: null,
        },
        landmarkInfo: null,
      },
    }
  }

  async doSweeping() {
    if( this.currentStatus === 'VacuumMode.IDLE' || this.newRoomsSelected ) {
      /*
       *   Check for special case of '*Entire Floor*' being checked In addition to other rooms.
       *   If true, remove the other rooms from the list
       */
      if( this.selectedAreas.length > 0 ) {
        for (let i = 0; i < this.selectedAreas.length; i++) {
          const areaId = this.selectedAreas[i];
          this.myLogger(`before StartSweep, selectedRoom[${i}] = '${areaId}'`);
          for (let j = 0; j < this.supportedAreas.length; j++) {
            const area = this.supportedAreas[j];
            if( area.areaId === areaId ) {
              this.myLogger(`selected room name = '${area.areaInfo.locationInfo.locationName}'`);
              if( area.areaInfo.locationInfo.locationName === '*Entire Floor*' ) {
                this.selectedAreas.length = 0;
                this.selectedAreas.push( area.areaId );
                this.log.info('Changing selected room(s) to be "*Entire Floor*"');
                break;
              }
            }
          }
        }
      } else { // No rooms are selected. Assume '*Entire Floor*' on 1st floor
        this.selectedAreas.push( 1 );
        this.log.info('Changing selected room to be "*Entire Floor*"');
      }
      /*
      * Start sweeping
      */
      this.newRoomsSelected = false;
      await this.setFloor();     // Set current floor based on what rooms were selected
      await this.startSweeping();   // Start sweeping when docked
    } else {
      await this.startCleaning();   // Resume cleaning after a pause
    }
    if( this.roboticVacuum ) {
      await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 2, this.log); // Cleaning
      await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState',
        RvcOperationalState.OperationalState.Running, this.log);
      await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError',
        { errorStateId: RvcOperationalState.ErrorState.NoError }, this.log);
      await this.roboticVacuum.updateAttribute(ServiceArea.Cluster.id, 'currentArea', this.selectedAreas[0], this.log);
    }
    let doLoop : boolean = true;
    while( doLoop ) {  // Wait for sweeping to finish (status = VacuumMode.IDLE)
      for( let i = 0; i < this.statusRefreshInterval; i++ ) {
        if( this.currentStatus === 'VacuumMode.IDLE' || this.currentStatus === 'VacuumMode.PAUSED'
                                                    || this.currentStatus === 'VacuumMode.DOCKED_NOT_COMPLETE' ) {
          doLoop = false;
          break;
        }
        if( this.pokeStatusLoop ) {
          break;   // Something external poked here. Re-evaluate for statusRefreshInterval
        }
        await setTimeout(1000);
      }
      if( doLoop === false ) {
        break;
      }
      this.myLogger(`waiting for sweeping to finish: Status = '${this.currentStatus}'`);
    }
    this.pokeStatusLoop = true;
  }

  async startStatusLoop() {
    while( true ) {
      let refreshInterval = 0;
      refreshInterval = Number(await this.getStatus() );
      this.myLogger(`in startStatusLoop(): after getStatus(): refreshInterval = ${refreshInterval} seconds`);
      for( let i = 0; i < refreshInterval; i++ ) {
        if( this.pokeStatusLoop ) {
          break;   // Something external poked here. Re-evaluate for statusRefreshInterval
        }
        await setTimeout(1000);
      }
      this.pokeStatusLoop = false;
    }
  }
}
