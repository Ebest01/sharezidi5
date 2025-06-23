import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useFileTransfer } from '../hooks/useFileTransfer';
import { TransferSyncMonitor } from './TransferSyncMonitor';
import { FileSelector } from './FileSelector';
import { DeviceList } from './DeviceList';
import { ErrorRecoveryPanel } from './ErrorRecoveryPanel';
import type { Device } from '@shared/types';

export const ShareZidiApp: React.FC = () => {
  const websocket = useWebSocket();
  const fileTransfer = useFileTransfer(websocket);

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
        {/* Transfer Sync Monitor */}
        <TransferSyncMonitor 
          transfers={fileTransfer.transfers}
          connectionInfo={connectionInfo}
        />

        {/* File Selection */}
        <FileSelector
          selectedFiles={fileTransfer.selectedFiles}
          isDragging={fileTransfer.isDragging}
          fileInputRef={fileTransfer.fileInputRef}
          onFileSelect={fileTransfer.handleFileSelect}
          onDragOver={fileTransfer.handleDragOver}
          onDragLeave={fileTransfer.handleDragLeave}
          onDrop={fileTransfer.handleDrop}
          onOpenFileDialog={fileTransfer.openFileDialog}
          onRemoveFile={fileTransfer.removeFile}
          totalSizeMB={fileTransfer.getTotalSizeMB()}
        />

        {/* Device List */}
        <DeviceList
          devices={websocket.devices}
          selectedFiles={fileTransfer.selectedFiles}
          transfers={fileTransfer.transfers}
          onSendFiles={handleSendFiles}
          onZipAndSend={handleZipAndSend}
        />

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
    </div>
  );
};
