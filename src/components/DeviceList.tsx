import React from 'react';
import type { Device, TransferProgress } from '@shared/types';
import type { SelectedFile } from '../types/transfer';

interface DeviceListProps {
  devices: Device[];
  selectedFiles: SelectedFile[];
  transfers: Map<string, TransferProgress>;
  onSendFiles: (device: Device) => void;
  onZipAndSend: (device: Device) => void;
}

export const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  selectedFiles,
  transfers,
  onSendFiles,
  onZipAndSend
}) => {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return 'fas fa-mobile-alt';
      case 'laptop': return 'fas fa-laptop';
      case 'tablet': return 'fas fa-tablet';
      default: return 'fas fa-desktop';
    }
  };

  const getDeviceIconColor = (online: boolean) => {
    return online ? 'text-primary' : 'text-gray-400';
  };

  const getActiveTransfer = (deviceId: string): TransferProgress | undefined => {
    return Array.from(transfers.values()).find(
      t => t.deviceId === deviceId && t.isTransferring
    );
  };

  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Available Devices</h2>
      
      <div className="space-y-4">
        {devices.map(device => {
          const activeTransfer = getActiveTransfer(device.id);
          const hasActiveTransfer = !!activeTransfer;
          const syncLag = activeTransfer 
            ? activeTransfer.sentProgress - activeTransfer.receivedProgress 
            : 0;
          const hasIssues = syncLag > 10 || (activeTransfer?.duplicateChunks || 0) > 100;

          return (
            <div key={device.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    device.online ? 'bg-primary/10' : 'bg-gray-100'
                  }`}>
                    <i className={`${getDeviceIcon(device.type)} ${getDeviceIconColor(device.online)} text-lg`}></i>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-lg">{device.name}</div>
                    <div className="text-sm text-gray-500 flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${
                        device.online ? 'bg-success' : 'bg-gray-400'
                      }`}></span>
                      <span>
                        {device.online 
                          ? hasActiveTransfer 
                            ? 'Transfer in progress' 
                            : 'Ready to receive'
                          : `Offline • Last seen ${device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'unknown'}`
                        }
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Status Badge */}
                {hasActiveTransfer && (
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    hasIssues 
                      ? 'bg-orange-100 text-orange-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {hasIssues ? 'Sync Issues' : 'Transferring'}
                  </div>
                )}
                
                {/* Action Buttons */}
                {device.online && !hasActiveTransfer && selectedFiles.length > 0 && (
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => onSendFiles(device)}
                      className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center space-x-2"
                    >
                      <i className="fas fa-paper-plane"></i>
                      <span>Send Files</span>
                    </button>
                    <button 
                      onClick={() => onZipAndSend(device)}
                      className="bg-secondary text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center space-x-2"
                    >
                      <i className="fas fa-file-archive"></i>
                      <span>ZIP & Send</span>
                    </button>
                  </div>
                )}
                
                {!device.online && (
                  <button 
                    disabled 
                    className="bg-gray-300 text-gray-500 px-6 py-2 rounded-lg font-medium cursor-not-allowed"
                  >
                    Unavailable
                  </button>
                )}
              </div>
              
              {/* Transfer Statistics */}
              {activeTransfer && (
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-lg font-semibold text-primary">
                      {activeTransfer.sentProgress.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Sent</div>
                  </div>
                  <div className={`rounded-lg p-3 ${
                    hasIssues ? 'bg-orange-50' : 'bg-green-50'
                  }`}>
                    <div className={`text-lg font-semibold ${
                      hasIssues ? 'text-warning' : 'text-success'
                    }`}>
                      {activeTransfer.receivedProgress.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Received</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-semibold text-gray-700">
                      {activeTransfer.duplicateChunks}
                    </div>
                    <div className="text-xs text-gray-600">Duplicates</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {devices.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-gray-400 mb-2">
              <i className="fas fa-search text-2xl"></i>
            </div>
            <p className="text-gray-600">No devices found</p>
            <p className="text-sm text-gray-500 mt-1">Make sure other devices are connected to the same network</p>
          </div>
        )}
      </div>
    </section>
  );
};
