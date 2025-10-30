import React from 'react'
import { Smartphone, Monitor, Wifi, WifiOff } from 'lucide-react'

interface Device {
  id: string
  name: string
  type: 'mobile' | 'desktop' | 'tablet'
  online: boolean
  lastSeen: string
  capabilities: {
    supportsWebRTC: boolean
    supportsP2P: boolean
    maxChunkSize: number
  }
}

interface DeviceListProps {
  devices: Device[]
  onDeviceSelect: (deviceId: string) => void
  selectedDeviceId?: string
}

export const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  onDeviceSelect,
  selectedDeviceId
}) => {
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />
      case 'desktop':
        return <Monitor className="w-5 h-5" />
      default:
        return <Monitor className="w-5 h-5" />
    }
  }

  const getDeviceTypeColor = (type: string) => {
    switch (type) {
      case 'mobile':
        return 'text-green-600'
      case 'desktop':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-3">
      {devices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <WifiOff className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No devices found</p>
          <p className="text-sm">Make sure devices are on the same network</p>
        </div>
      ) : (
        devices.map((device) => (
          <div
            key={device.id}
            className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
              selectedDeviceId === device.id
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
            onClick={() => onDeviceSelect(device.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`${getDeviceTypeColor(device.type)}`}>
                  {getDeviceIcon(device.type)}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{device.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{device.type}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {device.online ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`text-xs ${
                    device.online ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {device.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                {device.capabilities.supportsWebRTC && (
                  <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    WebRTC
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>Last seen: {formatLastSeen(device.lastSeen)}</span>
              <span>Max: {(device.capabilities.maxChunkSize / 1024 / 1024).toFixed(1)}MB</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}




