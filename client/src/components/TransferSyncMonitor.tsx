import React from 'react';
import type { TransferProgress } from '@shared/types';

interface TransferSyncMonitorProps {
  transfers: Map<string, TransferProgress>;
  connectionInfo: {
    effectiveType?: string;
    downlink?: number;
    status: string;
  };
}

export const TransferSyncMonitor: React.FC<TransferSyncMonitorProps> = ({
  transfers,
  connectionInfo
}) => {
  const activeTransfers = Array.from(transfers.values()).filter(t => t.isTransferring);
  
  if (activeTransfers.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <i className="fas fa-exchange-alt text-primary"></i>
          <span>Transfer Synchronization</span>
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <i className="fas fa-wifi text-success"></i>
          <span>
            {connectionInfo.effectiveType?.toUpperCase() || 'Unknown'}
            {connectionInfo.downlink && ` (${connectionInfo.downlink} Mbps)`}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {activeTransfers.map((transfer) => {
          const syncLag = transfer.sentProgress - transfer.receivedProgress;
          const hasIssues = syncLag > 10 || transfer.duplicateChunks > 100;
          
          return (
            <div key={`${transfer.deviceId}-${transfer.fileInfo.name}`}>
              {/* Sender View */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <i className="fas fa-upload text-white text-sm"></i>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        Sending to Device {transfer.deviceId}
                      </div>
                      <div className="text-sm text-gray-600">
                        {transfer.fileInfo.name} ({(transfer.fileInfo.size / 1024 / 1024).toFixed(1)} MB)
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-primary">
                      {transfer.sentProgress.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Sender Status</div>
                  </div>
                </div>
                
                <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${transfer.sentProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-600">
                  {transfer.sentProgress === 100 ? '✅ All chunks sent successfully' : 'Sending...'}
                </div>
              </div>

              {/* Receiver View */}
              <div className={`rounded-lg p-4 border ${
                hasIssues 
                  ? 'bg-orange-50 border-orange-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      hasIssues 
                        ? 'bg-warning pulse-warning' 
                        : 'bg-success'
                    }`}>
                      <i className="fas fa-download text-white text-sm"></i>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        Receiving from Device {transfer.deviceId}
                      </div>
                      <div className="text-sm text-gray-600">
                        {transfer.fileInfo.name} ({(transfer.fileInfo.size / 1024 / 1024).toFixed(1)} MB)
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${
                      hasIssues ? 'text-warning' : 'text-success'
                    }`}>
                      {transfer.receivedProgress.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Receiver Status</div>
                  </div>
                </div>
                
                <div className={`w-full rounded-full h-2 mb-2 ${
                  hasIssues ? 'bg-orange-200' : 'bg-green-200'
                }`}>
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      hasIssues ? 'bg-warning' : 'bg-success'
                    }`}
                    style={{ width: `${transfer.receivedProgress}%` }}
                  ></div>
                </div>
                
                {hasIssues && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="text-orange-700 flex items-center space-x-1">
                      <i className="fas fa-exclamation-triangle"></i>
                      <span>
                        ⚠️ Sync lag detected: {syncLag.toFixed(1)}% behind
                      </span>
                    </div>
                    {transfer.duplicateChunks > 0 && (
                      <div className="text-orange-600">
                        {transfer.duplicateChunks} duplicates rejected
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              {hasIssues && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 mt-2">
                  <div className="flex items-center space-x-4">
                    <button className="bg-warning text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center space-x-2">
                      <i className="fas fa-sync sync-spinner"></i>
                      <span>Force Sync</span>
                    </button>
                    <button className="bg-error text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center space-x-2">
                      <i className="fas fa-stop"></i>
                      <span>Cancel Transfer</span>
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Status:</span> 
                    <span className="text-warning font-semibold ml-1">
                      {transfer.status}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
