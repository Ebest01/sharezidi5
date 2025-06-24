import React from 'react';
import { TransferUtils } from '../lib/transferUtils';
import type { SelectedFile } from '../types/transfer';

interface FileSelectorProps {
  selectedFiles: SelectedFile[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onOpenFileDialog: () => void;
  onRemoveFile: (index: number) => void;
  totalSizeMB: string;
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  selectedFiles,
  isDragging,
  fileInputRef,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenFileDialog,
  onRemoveFile,
  totalSizeMB
}) => {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Files to Transfer</h2>
      
      <div 
        className={`bg-white rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          isDragging 
            ? 'border-primary/50 bg-blue-50' 
            : 'border-primary/30 hover:border-primary/50'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onOpenFileDialog}
      >
        <div className="mb-4">
          <i className="fas fa-cloud-upload-alt text-4xl text-primary"></i>
        </div>
        <p className="text-gray-600 mb-2">
          <span className="font-semibold">Drag & Drop</span> files here or{' '}
          <span className="text-primary underline font-medium">browse</span>
        </p>
        <p className="text-sm text-gray-500">Supports multiple files up to 500MB each</p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {selectedFiles && selectedFiles.length > 0 && (
        <div className="mt-6 space-y-3">
          {(selectedFiles || []).map((file, index) => (
            <div key={file.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  file.type && file.type.startsWith('image/') ? 'bg-green-100' :
                  file.type && file.type.startsWith('video/') ? 'bg-red-100' :
                  file.type && file.type.startsWith('audio/') ? 'bg-purple-100' :
                  file.type && file.type.includes('pdf') ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                  <i className={`${TransferUtils.getFileIcon(file.type || '')} ${TransferUtils.getFileIconColor(file.type || '')}`}></i>
                </div>
                <div>
                  <div className="font-medium text-gray-800">
                    {TransferUtils.formatFileName(file?.name || 'Unknown')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {TransferUtils.formatFileSize(file.size || 0)} • Optimized: {file.parallelStreams || 1} streams, {((file.optimizedChunkSize || 8192)/1024).toFixed(0)}KB chunks
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onRemoveFile(index)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}
          
          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={() => {
                // Clear all files
                for (let i = selectedFiles.length - 1; i >= 0; i--) {
                  onRemoveFile(i);
                }
              }}
              className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              Clear all files
            </button>
            <span className="font-semibold text-gray-700 dark:text-gray-300">Total: {totalSizeMB}</span>
          </div>
        </div>
      )}
    </section>
  );
};
