import React, { useState } from 'react'
import { Send, Download, Wifi, Smartphone, Monitor, Zap } from 'lucide-react'

interface ShareZidiAppProps {
  isConnected: boolean
  devices: any[]
  transfers: any[]
  webrtc: any
  fileTransfer: any
}

export const ShareZidiApp: React.FC<ShareZidiAppProps> = ({
  isConnected,
  devices,
  transfers,
  webrtc,
  fileTransfer
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      setSelectedFiles(Array.from(files))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleSendFiles = async () => {
    if (!selectedDevice || selectedFiles.length === 0) return

    for (const file of selectedFiles) {
      await fileTransfer.sendFile(file, selectedDevice, webrtc.isSupported)
    }
    
    setSelectedFiles([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">ShareZidi v3.0</h1>
          </div>
          <p className="text-lg text-gray-600 mb-2">Ultimate P2P File Transfer</p>
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center">
              <Wifi className="w-4 h-4 mr-1" />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="flex items-center">
              <Zap className="w-4 h-4 mr-1" />
              {webrtc.isSupported ? 'WebRTC Ready' : 'WebRTC Not Available'}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`p-4 rounded-lg ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {isConnected ? 'Connected to ShareZidi Server' : 'Disconnected from Server'}
            </div>
          </div>
        </div>

        {/* File Selection */}
        <div className="mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Drop files here or click to select
            </h3>
            <p className="text-gray-600 mb-4">
              Support for all file types • Up to 10GB per file
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="btn btn-primary px-6 py-2 cursor-pointer"
            >
              Choose Files
            </label>
          </div>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Selected Files</h3>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <Download className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Device Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Device</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedDevice === device.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDevice(device.id)}
              >
                <div className="flex items-center mb-2">
                  {device.type === 'mobile' ? (
                    <Smartphone className="w-5 h-5 text-gray-600 mr-2" />
                  ) : (
                    <Monitor className="w-5 h-5 text-gray-600 mr-2" />
                  )}
                  <span className="font-medium text-gray-900">{device.name}</span>
                </div>
                <p className="text-sm text-gray-500">{device.type}</p>
                <div className="flex items-center mt-2">
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    device.online ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-xs text-gray-500">
                    {device.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Send Button */}
        {selectedFiles.length > 0 && selectedDevice && (
          <div className="text-center">
            <button
              onClick={handleSendFiles}
              className="btn btn-primary px-8 py-3 text-lg"
              disabled={!isConnected}
            >
              <Send className="w-5 h-5 mr-2" />
              Send {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Active Transfers */}
        {transfers.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Transfers</h3>
            <div className="space-y-3">
              {transfers.map((transfer) => (
                <div key={transfer.id} className="p-4 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{transfer.file.name}</span>
                    <span className="text-sm text-gray-500">{transfer.status}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${transfer.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{transfer.progress.toFixed(1)}%</span>
                    <span>{fileTransfer.formatSpeed(transfer.speed)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}




