import React from 'react';
import type { TransferProgress } from '@shared/types';

interface TransferSyncMonitorProps {
  transfers: Map<string, TransferProgress>;
  incomingTransfers: Map<string, TransferProgress>;
  connectionInfo: {
    effectiveType?: string;
    downlink?: number;
    status: string;
  };
}

export const TransferSyncMonitor: React.FC<TransferSyncMonitorProps> = ({
  transfers,
  incomingTransfers,
  connectionInfo
}) => {
  const activeOutgoingTransfers = Array.from(transfers.values()).filter(t => t.isTransferring);
  const activeIncomingTransfers = Array.from(incomingTransfers?.values() || []).filter(t => t.isTransferring || t.status === 'completed');
  
  if (activeOutgoingTransfers.length === 0 && activeIncomingTransfers.length === 0) {
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
        {/* Outgoing Transfers (Sender View) */}
        {activeOutgoingTransfers.map((transfer) => {
          const syncLag = transfer.sentProgress - transfer.receivedProgress;
          const hasIssues = syncLag > 10 || transfer.duplicateChunks > 100;
          
          return (
            <div key={`outgoing-${transfer.deviceId}-${transfer.fileInfo.name}`}>
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
        
        {/* Incoming Transfers (Receiver View) */}
        {activeIncomingTransfers.map((transfer) => {
          const syncLag = transfer.sentProgress - transfer.receivedProgress;
          const hasIssues = syncLag > 10 || transfer.duplicateChunks > 100;
          
          return (
            <div key={`incoming-${transfer.deviceId}-${transfer.fileInfo.name}`}>
              {/* Receiver View */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 mb-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <i className="fas fa-download text-white text-sm"></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">Receiving from {transfer.deviceId}</h4>
                      <p className="text-sm text-gray-600">{transfer.fileInfo.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {transfer.receivedProgress.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {(transfer.fileInfo.size / (1024 * 1024)).toFixed(1)} MB
                    </div>
                  </div>
                </div>

                {/* Receiving Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Receiving Progress</span>
                    <span>{transfer.receivedProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(transfer.receivedProgress, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Sender Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Sender Progress</span>
                    <span>{transfer.sentProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(transfer.sentProgress, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Sync Status */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 rounded-full ${
                      transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                      transfer.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                    </span>
                    <span className="text-gray-600">
                      Sync Lag: {syncLag.toFixed(1)}%
                    </span>
                  </div>
                  {hasIssues && (
                    <div className="flex items-center space-x-1 text-yellow-600">
                      <i className="fas fa-exclamation-triangle"></i>
                      <span>Issues detected</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
