/* eslint-disable react-native/no-inline-styles */
import React, {useCallback, useEffect, useState} from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';

import BleManager, {Peripheral} from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

function App(): React.JSX.Element {
  const [devices, setDevices] = useState(new Map<string, any>());

  const handleRetreiveServices = useCallback(async (deviceId: string) => {
    try {
      console.log('Retrieving services for', deviceId);
      const startTimestamp = +Date.now();
      const res = await BleManager.retrieveServices(deviceId);
      console.log(
        'Retrieved services for ' + deviceId,
        [[Math.abs(startTimestamp - +Date.now()) / 1000]],
        '\n\n',
        JSON.stringify(
          {
            char: res.characteristics?.length,
            service: res.services?.length,
          },
          null,
          2,
        ),
      );
    } catch (error: any) {
      console.log('Retreives services failed, trying to connect...')
      BleManager.connect(deviceId);
    }
  }, []);

  useEffect(() => {
    BleManager.start({})
      .then(() => {
        return handleAndroidPermissions();
      })
      .then(() => {
        console.log('BleManager started');
      });

    bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      (peripheral: Peripheral) => {
        console.log(
          'BleManagerDiscoverPeripheral',
          peripheral.advertising.localName,
        );

        setDevices(prev => {
          prev.set(peripheral.id, {
            id: peripheral.id,
            name: peripheral.advertising.localName,
            isConnected: false,
          });

          return new Map(prev);
        });
      },
    );

    bleManagerEmitter.addListener(
      'BleManagerConnectPeripheral',
      async ({peripheral}) => {
        try {
          setDevices(prev => {
            const device = prev.get(peripheral);
            prev.set(device.id, {
              ...device,
              isConnected: true,
            });

            console.log('BleManagerConnectPeripheral', peripheral);
            return new Map(prev);
          });
          handleRetreiveServices(peripheral);
        } catch (error) {
          console.error(error);
        }
      },
    );

    bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      ({peripheral}) => {
        setDevices(prev => {
          const device = prev.get(peripheral);
          prev.set(device.id, {
            ...device,
            isConnected: false,
          });

          console.log('BleManagerDisconnectPeripheral', peripheral);
          return new Map(prev);
        });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = useCallback(() => {
    BleManager.scan([], 3, false, {
      exactAdvertisingName: [
        // 'NAVIGATION-REMOTE',
        'U1SMARTLIGHT',
        'UNIT1 AURA',
        'UNIT1 FARO',
      ],
    }).then(() => {
      console.log('Scanning...');
    });
  }, []);

  const handleAndroidPermissions = () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]).then(result => {
        if (result) {
          console.debug(
            '[handleAndroidPermissions] User accepts runtime permissions android 12+',
          );
        } else {
          console.error(
            '[handleAndroidPermissions] User refuses runtime permissions android 12+',
          );
        }
      });
    } else if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then(checkResult => {
        if (checkResult) {
          console.debug(
            '[handleAndroidPermissions] runtime permission Android <12 already OK',
          );
        } else {
          PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ).then(requestResult => {
            if (requestResult) {
              console.debug(
                '[handleAndroidPermissions] User accepts runtime permission android <12',
              );
            } else {
              console.error(
                '[handleAndroidPermissions] User refuses runtime permission android <12',
              );
            }
          });
        }
      });
    }
  };

  const handleConnectAll = useCallback(() => {
    Array.from(devices.values()).forEach(device => {
      if (!device.isConnected) {
        BleManager.connect(device.id, {autoconnect: true}).catch(err => {
          console.error(err, 'RETRYING...', [device.name]);
          return BleManager.connect(device.id);
        });
      }
    });
  }, [devices]);

  const handleDisconnectAll = useCallback(() => {
    Array.from(devices.values()).forEach(device => {
      if (device.isConnected) {
        BleManager.disconnect(device.id).catch(err => {
          console.error(err, 'RETRYING...');
        });
      }
    });
  }, [devices]);

  return (
    <SafeAreaView>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <View style={header}>
            <TouchableHighlight onPress={handleScan} style={[btn, scanBtn]}>
              <Text style={scanBtnText}>Scan</Text>
            </TouchableHighlight>
          </View>
          <View style={header}>
            <TouchableHighlight
              onPress={handleDisconnectAll}
              style={[btn, {backgroundColor: 'red'}]}>
              <Text style={scanBtnText}>Disconnect All</Text>
            </TouchableHighlight>
            <TouchableHighlight
              onPress={handleConnectAll}
              style={[btn, {backgroundColor: 'green'}]}>
              <Text style={scanBtnText}>Connect All</Text>
            </TouchableHighlight>
          </View>
          <View
            style={{
              flex: 1,
              width: '100%',
              padding: 20,
              gap: 10,
            }}>
            {Array.from(devices.values()).map((device: any, index: number) => {
              return (
                <View
                  key={device.id}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 5,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    backgroundColor: `rgba(155,155,155,${
                      index % 2 ? 0.5 : 0.2
                    })`,
                  }}>
                  <View>
                    <Text style={{color: 'black'}}>{device.name}</Text>
                    <Text
                      style={{
                        color: 'rgba(140,140,140,1)',
                        fontSize: 10,
                        paddingLeft: 4,
                      }}>
                      {device.id}
                    </Text>
                  </View>
                  <TouchableHighlight
                    onPress={() => {
                      if (device.isConnected) {
                        BleManager.disconnect(device.id);
                      } else {
                        BleManager.connect(device.id);
                      }
                    }}
                    style={[
                      btn,
                      device.isConnected ? disconnectBtn : connectedBtn,
                    ]}>
                    <Text style={{color: 'white'}}>
                      {device.isConnected ? 'Disconnect' : 'Connect'}
                    </Text>
                  </TouchableHighlight>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default App;

const {header, btn, scanBtnText, scanBtn, connectedBtn, disconnectBtn} =
  StyleSheet.create({
    header: {
      width: '100%',
      paddingVertical: 10,
      paddingHorizontal: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      gap: 10,
    },
    btn: {
      minWidth: 100,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 5,
    },

    scanBtn: {
      backgroundColor: 'blue',
    },
    connectedBtn: {
      backgroundColor: 'green',
    },
    disconnectBtn: {
      backgroundColor: 'red',
    },
    scanBtnText: {
      color: 'white',
      textAlign: 'center',
    },
  });
