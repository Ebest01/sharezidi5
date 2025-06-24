import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { TransferSyncMonitor } from './TransferSyncMonitor';
import { FileSelector } from './FileSelector';
import { DeviceList } from './DeviceList';
import { ErrorRecoveryPanel } from './ErrorRecoveryPanel';
import { ConnectionHelper } from './ConnectionHelper';
import { MobileTransferGuard } from './MobileTransferGuard';
import { ZipProgress } from './ZipProgress';
import type { Device } from '@shared/types';

export const ShareZidiApp: React.FC = () => {
  const websocket = useWebSocket();
  const fileTransfer = useFileTransfer(websocket);
  const [showConnectionHelper, setShowConnectionHelper] = useState(false);

  const connectionInfo = {
    effectiveType: (navigator as any).connection?.effectiveType,
    downlink: (navigator as any).connection?.downlink,
    status: websocket.isConnected ? 'connected' : websocket.reconnectAttempts > 0 ? 'reconnecting' : 'disconnected'
  };

  const handleSendFiles = async (device: Device) => {
    try {
      await fileTransfer.startTransfer(device, fileTransfer.selectedFiles);
    } catch (error) {
      console.error('Failed to start transfer:', error);
    }
  };

  const handleZipAndSend = async (device: Device) => {
    // TODO: Implement ZIP functionality
    console.log('ZIP and send not implemented yet');
  };

  const handleRetryTransfer = (transferId: string) => {
    console.log('Retry transfer:', transferId);
    // TODO: Implement retry logic
  };

  const handleReduceChunkSize = (transferId: string) => {
    console.log('Reduce chunk size:', transferId);
    // TODO: Implement chunk size reduction
  };

  const handleResumeMissingChunks = (transferId: string) => {
    console.log('Resume missing chunks:', transferId);
    // TODO: Implement missing chunk resume
  };

  const handleCancelTransfer = (transferId: string) => {
    console.log('Cancel transfer:', transferId);
    // TODO: Implement transfer cancellation
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=40" 
                alt="ShareZidi Logo" 
                className="h-10"
              />
              <div className="text-lg font-semibold text-gray-800">ShareZidi</div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  websocket.isConnected ? 'bg-success' : 'bg-error'
                }`}></div>
                <span className="text-gray-600">
                  {websocket.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-primary font-medium">
                ID: <span className="text-secondary">{websocket.userId}</span>
              </div>
              <button 
                onClick={() => setShowConnectionHelper(true)}
                className="p-2 text-primary hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors mr-2"
                title="Connect Mobile Device"
              >
                <i className="fas fa-qrcode text-sm"></i>
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <i className="fas fa-sync-alt text-sm"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Mobile Transfer Guard */}
        <MobileTransferGuard 
          isTransferring={Array.from(fileTransfer.transfers.values()).some(t => t.isTransferring) || 
                          Array.from(fileTransfer.incomingTransfers?.values() || []).some(t => t.isTransferring)} 
        />
        
        {/* ZIP Progress */}
        <ZipProgress 
          isZipping={fileTransfer.isZipping}
          progress={fileTransfer.zipProgress}
        />
        
        {/* Transfer Sync Monitor */}
        <TransferSyncMonitor 
          transfers={fileTransfer.transfers}
          incomingTransfers={fileTransfer.incomingTransfers || new Map()}
          connectionInfo={connectionInfo}
        />

        {/* File Selection */}
        <FileSelector
          selectedFiles={fileTransfer.selectedFiles}
          isDragging={fileTransfer.isDragging}
          fileInputRef={fileTransfer.fileInputRef}
          onFileSelect={(e) => fileTransfer.addFiles(e.target.files!)}
          onDragOver={fileTransfer.handleDragOver}
          onDragLeave={fileTransfer.handleDragLeave}
          onDrop={fileTransfer.handleDrop}
          onOpenFileDialog={fileTransfer.openFileDialog}
          onRemoveFile={fileTransfer.removeFile}
          totalSizeMB={fileTransfer.totalSizeMB.toFixed(2)}
        />

        {/* Device List */}
        <DeviceList
          devices={websocket.devices}
          selectedFiles={fileTransfer.selectedFiles}
          transfers={fileTransfer.transfers}
          onSendFiles={handleSendFiles}
          onZipAndSend={handleZipAndSend}
        />

        {/* Connection Help Banner when no devices */}
        {websocket.devices.length === 0 && websocket.isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <div className="text-blue-600 mb-2">
              <i className="fas fa-mobile-alt text-3xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Connect Your Mobile Device</h3>
            <p className="text-blue-700 mb-4">
              Scan the QR code or enter the URL manually to connect your iPhone, Android, or other devices
            </p>
            <button
              onClick={() => setShowConnectionHelper(true)}
              className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center space-x-2 mx-auto"
            >
              <i className="fas fa-qrcode"></i>
              <span>Show Connection Options</span>
            </button>
          </div>
        )}

        {/* Error Recovery Panel */}
        <ErrorRecoveryPanel
          transfers={fileTransfer.transfers}
          onRetryTransfer={handleRetryTransfer}
          onReduceChunkSize={handleReduceChunkSize}
          onResumeMissingChunks={handleResumeMissingChunks}
          onCancelTransfer={handleCancelTransfer}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>ShareZidi v2.1</span>
              <span>•</span>
              <span>Socket ID: {websocket.socketId}</span>
              <span>•</span>
              <span className={websocket.isConnected ? 'text-success' : 'text-error'}>
                {websocket.isConnected ? 'Connection Stable' : 'Connection Lost'}
              </span>
            </div>
            <button className="text-primary hover:text-blue-600 transition-colors">
              <i className="fas fa-cog mr-1"></i>
              Advanced Settings
            </button>
          </div>
        </div>
      </footer>

      {/* Connection Helper Modal */}
      <ConnectionHelper 
        isVisible={showConnectionHelper}
        onClose={() => setShowConnectionHelper(false)}
      />
    </div>
  );
};
