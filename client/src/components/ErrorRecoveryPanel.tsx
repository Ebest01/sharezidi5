import React from 'react';
import type { TransferProgress } from '@shared/types';

interface ErrorRecoveryPanelProps {
  transfers: Map<string, TransferProgress>;
  onRetryTransfer: (transferId: string) => void;
  onReduceChunkSize: (transferId: string) => void;
  onResumeMissingChunks: (transferId: string) => void;
  onCancelTransfer: (transferId: string) => void;
}

export const ErrorRecoveryPanel: React.FC<ErrorRecoveryPanelProps> = ({
  transfers,
  onRetryTransfer,
  onReduceChunkSize,
  onResumeMissingChunks,
  onCancelTransfer
}) => {
  const problematicTransfers = Array.from(transfers.entries()).filter(([_, transfer]) => {
    const syncLag = transfer.sentProgress - transfer.receivedProgress;
    return transfer.status === 'stalled' || 
           transfer.status === 'failed' || 
           syncLag > 10 || 
           transfer.duplicateChunks > 100;
  });

  if (problematicTransfers.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 bg-error rounded-full flex items-center justify-center flex-shrink-0">
          <i className="fas fa-exclamation-triangle text-white text-sm"></i>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 mb-2">Transfer Synchronization Issues Detected</h3>
          
          {problematicTransfers.map(([transferId, transfer]) => {
            const syncLag = transfer.sentProgress - transfer.receivedProgress;
            const stallTime = transfer.status === 'stalled' ? 'for over 30 seconds' : '';
            
            return (
              <div key={transferId} className="mb-4">
                <div className="text-sm text-red-700 space-y-1 mb-3">
                  <p>• Device {transfer.deviceId}: {transfer.fileInfo.name}</p>
                  {syncLag > 10 && (
                    <p>• Receiver is {syncLag.toFixed(1)}% behind sender ({transfer.duplicateChunks} duplicate chunks rejected)</p>
                  )}
                  {transfer.status === 'stalled' && (
                    <p>• Transfer stalled {stallTime} - implementing recovery protocol</p>
                  )}
                  {transfer.missingChunks.length > 0 && (
                    <p>• {transfer.missingChunks.length} chunks missing - attempting resume</p>
                  )}
                </div>
                
                {/* Recovery Actions */}
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => onRetryTransfer(transferId)}
                    className="bg-warning text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center space-x-2"
                  >
                    <i className="fas fa-redo"></i>
                    <span>Retry Transfer</span>
                  </button>
                  <button 
                    onClick={() => onReduceChunkSize(transferId)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <i className="fas fa-compress-arrows-alt"></i>
                    <span>Reduce Chunk Size</span>
                  </button>
                  <button 
                    onClick={() => onResumeMissingChunks(transferId)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <i className="fas fa-play"></i>
                    <span>Resume Missing Chunks</span>
                  </button>
                  <button 
                    onClick={() => onCancelTransfer(transferId)}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <i className="fas fa-stop"></i>
                    <span>Cancel & Reset</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
