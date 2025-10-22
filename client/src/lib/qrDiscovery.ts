// Browser-compatible QR code generation using canvas
const generateQRCodeCanvas = (text: string, canvas: HTMLCanvasElement, size: number = 256): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Simple QR code generation using a library or fallback
    try {
      // For now, we'll create a simple text-based QR representation
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, size, size);
      
      // Draw a simple placeholder QR code
      ctx.fillStyle = '#000';
      ctx.fillRect(10, 10, size - 20, size - 20);
      ctx.fillStyle = '#fff';
      ctx.fillRect(20, 20, size - 40, size - 40);
      
      // Add text
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', size / 2, size / 2 - 10);
      ctx.fillText('Placeholder', size / 2, size / 2 + 10);
      
      resolve(canvas.toDataURL());
    } catch (error) {
      reject(error);
    }
  });
};

export interface DeviceInfo {
  id: string;
  name: string;
  ip: string;
  port: number;
  capabilities: string[];
  lastSeen: number;
}

export interface QRCodeData {
  type: 'device-discovery' | 'transfer-request' | 'transfer-response';
  deviceId: string;
  deviceName: string;
  ip: string;
  port: number;
  transferId?: string;
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
}

export class QRDiscovery {
  private devices: Map<string, DeviceInfo> = new Map();
  private discoveryInterval: number | null = null;
  private broadcastInterval: number | null = null;
  private onDeviceFound?: (device: DeviceInfo) => void;
  private onTransferRequest?: (data: QRCodeData) => void;

  constructor() {
    this.startDiscovery();
  }

  static async generateQRCode(data: QRCodeData, canvasId: string): Promise<string> {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas element not found:', canvasId);
      return '';
    }
    const jsonString = JSON.stringify(data);
    await generateQRCodeCanvas(jsonString, canvas, 256);
    return jsonString; // Return the data string for logging/verification
  }

  // Generate QR code for device discovery
  async generateDeviceQR(deviceInfo: DeviceInfo): Promise<string> {
    const qrData: QRCodeData = {
      type: 'device-discovery',
      deviceId: deviceInfo.id,
      deviceName: deviceInfo.name,
      ip: deviceInfo.ip,
      port: deviceInfo.port
    };

    return await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  }

  // Generate QR code for transfer request
  async generateTransferQR(
    deviceInfo: DeviceInfo, 
    fileInfo: { name: string; size: number; type: string }
  ): Promise<string> {
    const qrData: QRCodeData = {
      type: 'transfer-request',
      deviceId: deviceInfo.id,
      deviceName: deviceInfo.name,
      ip: deviceInfo.ip,
      port: deviceInfo.port,
      transferId: this.generateTransferId(),
      fileInfo
    };

    return await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  }

  // Parse QR code data
  parseQRCode(qrCodeData: string): QRCodeData | null {
    try {
      const data = JSON.parse(qrCodeData);
      
      // Validate QR code data structure
      if (!data.type || !data.deviceId || !data.deviceName) {
        throw new Error('Invalid QR code data');
      }

      return data as QRCodeData;
    } catch (error) {
      console.error('[QRDiscovery] Failed to parse QR code:', error);
      return null;
    }
  }

  // Start device discovery
  private startDiscovery(): void {
    // Broadcast device presence every 5 seconds
    this.broadcastInterval = setInterval(() => {
      this.broadcastPresence();
    }, 5000);

    // Listen for device broadcasts
    this.discoveryInterval = setInterval(() => {
      this.scanForDevices();
    }, 2000);
  }

  // Broadcast device presence
  private broadcastPresence(): void {
    const deviceInfo: DeviceInfo = {
      id: this.getDeviceId(),
      name: this.getDeviceName(),
      ip: this.getLocalIP(),
      port: this.getLocalPort(),
      capabilities: this.getDeviceCapabilities(),
      lastSeen: Date.now()
    };

    // Store own device info
    this.devices.set(deviceInfo.id, deviceInfo);

    // Broadcast to local network (simplified - in real implementation, use UDP broadcast)
    this.broadcastToNetwork(deviceInfo);
  }

  // Scan for other devices
  private scanForDevices(): void {
    // In a real implementation, this would scan the local network
    // For now, we'll simulate device discovery
    this.simulateDeviceDiscovery();
  }

  // Simulate device discovery (replace with real network scanning)
  private simulateDeviceDiscovery(): void {
    // This would be replaced with actual network scanning
    // For demo purposes, we'll create some mock devices
    const mockDevices: DeviceInfo[] = [
      {
        id: 'device-001',
        name: 'iPhone 15 Pro',
        ip: '192.168.1.100',
        port: 8080,
        capabilities: ['file-transfer', 'qr-scan'],
        lastSeen: Date.now()
      },
      {
        id: 'device-002',
        name: 'MacBook Pro',
        ip: '192.168.1.101',
        port: 8080,
        capabilities: ['file-transfer', 'large-files'],
        lastSeen: Date.now()
      }
    ];

    mockDevices.forEach(device => {
      if (!this.devices.has(device.id)) {
        this.devices.set(device.id, device);
        this.onDeviceFound?.(device);
      }
    });
  }

  // Get discovered devices
  getDiscoveredDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).filter(device => 
      device.id !== this.getDeviceId() && 
      Date.now() - device.lastSeen < 30000 // 30 seconds timeout
    );
  }

  // Connect to device via QR code
  async connectToDevice(qrCodeData: string): Promise<DeviceInfo | null> {
    const data = this.parseQRCode(qrCodeData);
    if (!data) return null;

    const device: DeviceInfo = {
      id: data.deviceId,
      name: data.deviceName,
      ip: data.ip,
      port: data.port,
      capabilities: ['file-transfer'], // Default capabilities
      lastSeen: Date.now()
    };

    this.devices.set(device.id, device);
    return device;
  }

  // Handle transfer request from QR code
  handleTransferRequest(qrCodeData: string): QRCodeData | null {
    const data = this.parseQRCode(qrCodeData);
    if (data?.type === 'transfer-request') {
      this.onTransferRequest?.(data);
      return data;
    }
    return null;
  }

  // Set event handlers
  onDeviceFoundHandler(handler: (device: DeviceInfo) => void): void {
    this.onDeviceFound = handler;
  }

  onTransferRequestHandler(handler: (data: QRCodeData) => void): void {
    this.onTransferRequest = handler;
  }

  // Utility functions
  private getDeviceId(): string {
    return localStorage.getItem('sharezidi-device-id') || this.generateDeviceId();
  }

  private getDeviceName(): string {
    return localStorage.getItem('sharezidi-device-name') || this.getDefaultDeviceName();
  }

  private getLocalIP(): string {
    // In a real implementation, this would get the actual local IP
    return '192.168.1.50';
  }

  private getLocalPort(): number {
    return 8080;
  }

  private getDeviceCapabilities(): string[] {
    const capabilities = ['file-transfer'];
    
    // Add capabilities based on device type
    if (navigator.userAgent.includes('Mobile')) {
      capabilities.push('qr-scan', 'camera');
    }
    
    if (navigator.userAgent.includes('Chrome')) {
      capabilities.push('webrtc', 'large-files');
    }

    return capabilities;
  }

  private generateDeviceId(): string {
    const id = 'device-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sharezidi-device-id', id);
    return id;
  }

  private getDefaultDeviceName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Mac')) return 'MacBook';
    if (userAgent.includes('Windows')) return 'Windows PC';
    return 'ShareZidi Device';
  }

  private generateTransferId(): string {
    return 'transfer-' + Math.random().toString(36).substring(2, 15);
  }

  private broadcastToNetwork(deviceInfo: DeviceInfo): void {
    // In a real implementation, this would use UDP broadcast
    // For now, we'll just log the broadcast
    console.log('[QRDiscovery] Broadcasting device presence:', deviceInfo);
  }

  // Cleanup
  destroy(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
  }
}
