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
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenFileDialog();
          }
        }}
        aria-label="Drop files here or click to browse files"
        aria-describedby="file-upload-description"
      >
        <div className="mb-4">
          <i className="fas fa-cloud-upload-alt text-4xl text-primary"></i>
        </div>
        <p className="text-gray-600 mb-2">
          <span className="font-semibold">Drag & Drop</span> files here or{' '}
          <span className="text-primary underline font-medium">browse</span>
        </p>
        <p id="file-upload-description" className="text-sm text-gray-500">Supports multiple files up to 500MB each</p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFileSelect}
          className="hidden"
          aria-label="Select files to upload"
          accept="*/*"
        />
      </div>

      {selectedFiles && selectedFiles.length > 0 && (
        <div className="mt-6 space-y-3" role="region" aria-labelledby="selected-files-heading" aria-live="polite">
          <h3 id="selected-files-heading" className="sr-only">Selected Files ({selectedFiles.length})</h3>
          {(selectedFiles || []).map((file, index) => (
            <div key={file.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  file.type && file.type.startsWith('image/') ? 'bg-green-100' :
                  file.type && file.type.startsWith('video/') ? 'bg-red-100' :
                  file.type && file.type.startsWith('audio/') ? 'bg-purple-100' :
                  file.type && file.type.includes('pdf') ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                  <i className={`${TransferUtils.getFileIcon(file.type || '')} ${TransferUtils.getFileIconColor(file.type || '')}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">
                    {TransferUtils.formatFileName(file?.name || 'Unknown')}
                  </div>
                  <div className="text-sm text-gray-500">
                    {TransferUtils.formatFileSize(file.size || 0)} • Optimized: {file.parallelStreams || 1} streams, {((file.optimizedChunkSize || 8192)/1024).toFixed(0)}KB chunks
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onRemoveFile(index)}
                className="ml-3 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200 flex-shrink-0"
                title="Remove this file"
                aria-label={`Remove ${file.name}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
