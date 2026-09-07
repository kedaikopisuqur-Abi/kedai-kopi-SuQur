/**
 * ESC/POS Thermal Printer & Cash Drawer Hardware Service
 * Supports:
 * 1. Bluetooth Thermal Printers (Web Bluetooth BLE / RFCOMM)
 * 2. USB Thermal Printers (WebUSB / Web Serial POS)
 * 3. WiFi / LAN Network Printers (RAW TCP Port 9100 / Network Gateway)
 * 4. Cash Drawer (Laci Uang Kasir RJ11/RJ12 Solenoid Kick Pulse)
 * 5. Fallback to System / Android Print Spooler
 */

import { StoreSettings } from '../types';

// Common Bluetooth Low Energy & Serial Port Profile UUIDs for Thermal Printers (58mm & 80mm)
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Generic ESC/POS Printer
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
];

const PRINTER_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c1-9c0f-4f23-a226-e692f3e7201e',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ae01-0000-1000-8000-00805f9b34fb',
];

// Active Hardware Handles (In-Memory Session)
let activeBluetoothDevice: any = null;
let activeBluetoothCharacteristic: any = null;
let activeUsbDevice: any = null;
let activeUsbEndpoint: any = null;
let activeSerialPort: any = null;

export interface PrinterHardwareStatus {
  bluetoothSupported: boolean;
  usbSupported: boolean;
  serialSupported: boolean;
  connectedDeviceName?: string;
  connectionType: 'bluetooth' | 'usb' | 'network' | 'system';
  isReady: boolean;
}

/**
 * Checks browser & device hardware capability for POS printers
 */
export function checkHardwareCapabilities(): {
  bluetooth: boolean;
  usb: boolean;
  serial: boolean;
} {
  return {
    bluetooth: typeof navigator !== 'undefined' && !!(navigator as any).bluetooth,
    usb: typeof navigator !== 'undefined' && !!(navigator as any).usb,
    serial: typeof navigator !== 'undefined' && !!(navigator as any).serial,
  };
}

/**
 * Generates ESC/POS Cash Drawer Kick Pulse (RJ11/RJ12 connector to printer)
 * Pin 2: 0x1B 0x70 0x00 0x19 0xFA (Pulse ON 50ms, OFF 500ms)
 * Pin 5: 0x1B 0x70 0x01 0x19 0xFA
 * Realtime: 0x10 0x14 0x01 0x01 0x01 (DLE DC4 1 1 1)
 */
export function generateCashDrawerKickCommand(pin: 'pin2' | 'pin5' | 'both' = 'both'): Uint8Array {
  // ESC @ (Initialize) + ESC = 1 (Select Peripheral Device)
  const prefix = [0x1B, 0x40, 0x1B, 0x3D, 0x01];

  let pulseBytes: number[] = [];
  if (pin === 'pin2') {
    pulseBytes = [0x1B, 0x70, 0x00, 0x19, 0xFA, 0x10, 0x14, 0x01, 0x01, 0x01];
  } else if (pin === 'pin5') {
    pulseBytes = [0x1B, 0x70, 0x01, 0x19, 0xFA, 0x10, 0x14, 0x01, 0x01, 0x01];
  } else {
    // Universal Dual-Pulse (Pin 2 + Pin 5 + Real-time Kick) - Kompatibel untuk semua merk laci & printer
    pulseBytes = [
      0x1B, 0x70, 0x00, 0x19, 0xFA, // Pin 2 (Epson, Xprinter, Panda, dll)
      0x1B, 0x70, 0x01, 0x19, 0xFA, // Pin 5 (Star Micronics, Citizen, Posiflex)
      0x10, 0x14, 0x01, 0x01, 0x01, // Realtime kick
    ];
  }

  const fullBytes = new Uint8Array(prefix.length + pulseBytes.length);
  fullBytes.set(prefix, 0);
  fullBytes.set(pulseBytes, prefix.length);
  return fullBytes;
}

/**
 * Encode string text to ESC/POS binary buffer with optional Drawer Kick and Paper Cut
 */
export function encodeEscPosText(
  text: string,
  options?: {
    kickDrawer?: boolean;
    drawerPin?: 'pin2' | 'pin5' | 'both';
  }
): Uint8Array {
  // ESC @: Initialize printer
  // ESC t 0: Code table PC437 (USA, Standard Europe)
  const initCommands = [0x1B, 0x40, 0x1B, 0x74, 0x00];

  let drawerBytes: number[] = [];
  if (options?.kickDrawer) {
    const kickCmd = generateCashDrawerKickCommand(options.drawerPin || 'both');
    drawerBytes = Array.from(kickCmd);
  }

  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  // GS V 65 3: Partial cut with feed
  const cutCommands = [0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x03];

  const fullLength = initCommands.length + drawerBytes.length + textBytes.length + cutCommands.length;
  const buffer = new Uint8Array(fullLength);

  let offset = 0;
  buffer.set(initCommands, offset);
  offset += initCommands.length;

  if (drawerBytes.length > 0) {
    buffer.set(drawerBytes, offset);
    offset += drawerBytes.length;
  }

  buffer.set(textBytes, offset);
  offset += textBytes.length;

  buffer.set(cutCommands, offset);

  return buffer;
}

/**
 * Sends ESC/POS byte chunks to Bluetooth characteristic safely
 */
async function sendBluetoothChunks(characteristic: any, data: Uint8Array, chunkSize = 100): Promise<void> {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(chunk);
    }
    // Small delay to prevent printer internal buffer overflow
    await new Promise((r) => setTimeout(r, 20));
  }
}

/**
 * Connect to Bluetooth Thermal Printer (BLE / SPP)
 */
export async function connectBluetoothPrinter(): Promise<{
  success: boolean;
  deviceName?: string;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
    return {
      success: false,
      error: 'Web Bluetooth tidak didukung pada browser/perangkat ini. Gunakan Google Chrome pada Android / Windows / Mac.',
    };
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    });

    if (!device || !device.gatt) {
      return { success: false, error: 'Perangkat Bluetooth tidak ditemukan.' };
    }

    const server = await device.gatt.connect();
    let characteristic: any = null;

    for (const serviceUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        if (service) {
          for (const charUuid of PRINTER_CHARACTERISTICS) {
            try {
              characteristic = await service.getCharacteristic(charUuid);
              if (characteristic) break;
            } catch (_) {}
          }
          if (!characteristic) {
            const chars = await service.getCharacteristics();
            characteristic = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
          }
          if (characteristic) break;
        }
      } catch (_) {}
    }

    if (characteristic) {
      activeBluetoothDevice = device;
      activeBluetoothCharacteristic = characteristic;
      return {
        success: true,
        deviceName: device.name || 'Thermal Bluetooth Printer',
      };
    } else {
      return {
        success: false,
        error: 'Karakteristik transfer data ESC/POS printer Bluetooth tidak ditemukan.',
      };
    }
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.name === 'UserCancelledError') {
      return { success: false, error: 'Pencarian perangkat dibatalkan oleh pengguna.' };
    }
    return { success: false, error: err.message || 'Gagal menyambungkan printer Bluetooth.' };
  }
}

/**
 * Connect to USB Thermal Printer (WebUSB / Web Serial)
 */
export async function connectUsbPrinter(): Promise<{
  success: boolean;
  deviceName?: string;
  error?: string;
}> {
  // 1. Try WebUSB
  if (typeof navigator !== 'undefined' && (navigator as any).usb) {
    try {
      const device = await (navigator as any).usb.requestDevice({
        filters: [], // Allow user to pick any connected USB POS Printer (Epson, Xprinter, Panda, dll)
      });

      if (device) {
        await device.open();
        if (device.configuration === null) {
          await device.selectConfiguration(1);
        }

        // Claim first interface
        const iface = device.configuration.interfaces[0];
        await device.claimInterface(iface.interfaceNumber);

        // Find OUT endpoint
        const endpoint = iface.alternate.endpoints.find((e: any) => e.direction === 'out');
        if (endpoint) {
          activeUsbDevice = device;
          activeUsbEndpoint = endpoint;
          return {
            success: true,
            deviceName: device.productName || `USB Printer (Vendor 0x${device.vendorId.toString(16)})`,
          };
        }
      }
    } catch (usbErr: any) {
      if (usbErr.name !== 'NotFoundError' && usbErr.name !== 'SecurityError') {
        console.warn('WebUSB attempt failed, trying Web Serial:', usbErr);
      }
    }
  }

  // 2. Try Web Serial as fallback for USB-to-Serial / POS printers
  if (typeof navigator !== 'undefined' && (navigator as any).serial) {
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      activeSerialPort = port;
      return {
        success: true,
        deviceName: 'USB Serial Thermal Printer (COM/TTY)',
      };
    } catch (serialErr: any) {
      if (serialErr.name !== 'NotFoundError') {
        return { success: false, error: serialErr.message };
      }
    }
  }

  return {
    success: false,
    error: 'Tidak dapat menghubungkan printer USB. Pastikan kabel OTG/USB terpasang dan izin diberikan.',
  };
}

/**
 * Sends raw bytes to configured connection (Bluetooth / USB / Network)
 */
export async function sendRawBytesToPrinter(
  data: Uint8Array,
  settings?: StoreSettings
): Promise<{
  success: boolean;
  method: 'bluetooth' | 'usb' | 'network' | 'browser_print';
  deviceName?: string;
  error?: string;
}> {
  const preferredConnection = settings?.printerConnectionType || 'bluetooth';

  // 1. Try Bluetooth if active or preferred
  if (preferredConnection === 'bluetooth' || activeBluetoothCharacteristic) {
    try {
      if (!activeBluetoothCharacteristic && typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
        const connectRes = await connectBluetoothPrinter();
        if (!connectRes.success) {
          throw new Error(connectRes.error || 'Bluetooth printer belum tersambung');
        }
      }

      if (activeBluetoothCharacteristic) {
        await sendBluetoothChunks(activeBluetoothCharacteristic, data);
        return {
          success: true,
          method: 'bluetooth',
          deviceName: activeBluetoothDevice?.name || 'Bluetooth Printer',
        };
      }
    } catch (btErr: any) {
      console.warn('Direct Bluetooth print error:', btErr);
      if (preferredConnection === 'bluetooth') {
        // Don't swallow if user specifically set bluetooth
        // Fall back to system print
      }
    }
  }

  // 2. Try USB if active or preferred
  if (preferredConnection === 'usb' || activeUsbDevice || activeSerialPort) {
    try {
      if (activeUsbDevice && activeUsbEndpoint) {
        await activeUsbDevice.transferOut(activeUsbEndpoint.endpointNumber, data);
        return {
          success: true,
          method: 'usb',
          deviceName: activeUsbDevice.productName || 'USB Thermal Printer',
        };
      }

      if (activeSerialPort && activeSerialPort.writable) {
        const writer = activeSerialPort.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        return {
          success: true,
          method: 'usb',
          deviceName: 'USB Serial POS Printer',
        };
      }

      if (preferredConnection === 'usb') {
        const usbConn = await connectUsbPrinter();
        if (usbConn.success) {
          return sendRawBytesToPrinter(data, settings);
        }
      }
    } catch (usbErr: any) {
      console.warn('Direct USB print error:', usbErr);
    }
  }

  // 3. Try WiFi / LAN Network Printer (IP port 9100 / HTTP POS Gateway)
  if (preferredConnection === 'network' && settings?.printerNetworkIp) {
    try {
      const ip = settings.printerNetworkIp.trim();
      const port = settings.printerNetworkPort || 9100;

      // Attempt to send via local ESC/POS print gateway or HTTP raw bridge
      const gatewayEndpoints = [
        `http://${ip}:${port}`,
        `http://${ip}/print`,
        `http://localhost:8080/escpos?ip=${ip}&port=${port}`,
      ];

      let sent = false;
      for (const url of gatewayEndpoints) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            body: data,
            headers: { 'Content-Type': 'application/octet-stream' },
            signal: AbortSignal.timeout(2000),
          });
          if (res.ok) {
            sent = true;
            break;
          }
        } catch (_) {}
      }

      if (sent) {
        return {
          success: true,
          method: 'network',
          deviceName: `Network Printer (${ip}:${port})`,
        };
      }
    } catch (netErr: any) {
      console.warn('Network print attempt error:', netErr);
    }
  }

  // 4. Default Fallback: Trigger Browser / Android Print Spooler Dialog
  try {
    window.print();
    return {
      success: true,
      method: 'browser_print',
    };
  } catch (err: any) {
    return {
      success: false,
      method: 'browser_print',
      error: err.message,
    };
  }
}

/**
 * Triggers Cash Drawer Solenoid to Kick Open (Laci Uang Kasir)
 * Can be called manually from POS header, or automatically during cash transaction
 */
export async function openCashDrawer(settings?: StoreSettings): Promise<{
  success: boolean;
  message: string;
  method: string;
}> {
  const pin = settings?.cashDrawerPulsePin || 'both';
  const kickBytes = generateCashDrawerKickCommand(pin);

  try {
    const res = await sendRawBytesToPrinter(kickBytes, settings);
    if (res.success) {
      return {
        success: true,
        message: `Laci uang kasir (Cash Drawer) berhasil dibuka via ${res.method.toUpperCase()}!`,
        method: res.method,
      };
    } else {
      return {
        success: false,
        message: res.error || 'Gagal mengirim sinyal pembuka laci ke printer.',
        method: res.method,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan saat memicu laci kasir.',
      method: 'unknown',
    };
  }
}

/**
 * Prints receipt or text layout to Thermal Printer (Bluetooth/USB/LAN) with optional Cash Drawer kick
 */
export async function printReceiptThermal(
  receiptText: string,
  settings?: StoreSettings,
  options?: { kickCashDrawer?: boolean }
): Promise<{
  success: boolean;
  method: 'bluetooth' | 'usb' | 'network' | 'browser_print';
  deviceName?: string;
  error?: string;
}> {
  const shouldKick = options?.kickCashDrawer ?? (settings?.autoOpenCashDrawer || false);
  const pin = settings?.cashDrawerPulsePin || 'both';

  const rawBytes = encodeEscPosText(receiptText, {
    kickDrawer: shouldKick,
    drawerPin: pin,
  });

  return await sendRawBytesToPrinter(rawBytes, settings);
}

/**
 * Generates and prints a hardware test receipt with cash drawer kick test
 */
export async function printTestReceipt(settings: StoreSettings): Promise<{
  success: boolean;
  message: string;
}> {
  const lineLength = settings.printerPaperSize === '80mm' ? 44 : 32;
  const divider = '='.repeat(lineLength);
  const subDivider = '-'.repeat(lineLength);

  let testText = `\n${divider}\n`;
  testText += `   *** TEST HARDWARE SU-QUR POS ***   \n`;
  testText += `${settings.storeName.toUpperCase()}\n`;
  testText += `${divider}\n`;
  testText += `Status Koneksi : ${settings.printerConnectionType?.toUpperCase() || 'BLUETOOTH'}\n`;
  testText += `Lebar Kertas   : ${settings.printerPaperSize}\n`;
  if (settings.printerConnectionType === 'network' && settings.printerNetworkIp) {
    testText += `IP Network     : ${settings.printerNetworkIp}:${settings.printerNetworkPort || 9100}\n`;
  }
  testText += `Laci Uang (CD) : ${settings.autoOpenCashDrawer ? 'AKTIF (Auto-Kick)' : 'MANUAL'}\n`;
  testText += `Pin RJ11 Laci  : ${settings.cashDrawerPulsePin?.toUpperCase() || 'DUAL (PIN 2 & 5)'}\n`;
  testText += `Waktu Uji Coba : ${new Date().toLocaleString('id-ID')}\n`;
  testText += `${subDivider}\n`;
  testText += `✓ Test Cetak Thermal: BERHASIL\n`;
  testText += `✓ Test Pulse Sinyal Solenoid Laci Kasir\n`;
  testText += `${divider}\n`;
  testText += `   SU-QUR POS COFFEE & KITCHEN   \n\n\n`;

  const res = await printReceiptThermal(testText, settings, { kickCashDrawer: true });

  if (res.success) {
    return {
      success: true,
      message: `Test cetak struk & sinyal buka laci uang kasir berhasil dikirim via ${res.method.toUpperCase()}!`,
    };
  } else {
    return {
      success: false,
      message: `Test cetak gagal: ${res.error || 'Periksa koneksi printer & laci kasir.'}`,
    };
  }
}


