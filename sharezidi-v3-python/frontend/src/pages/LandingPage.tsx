import React from 'react'
import { Link } from 'react-router-dom'
import { Zap, Smartphone, Monitor, Wifi, Shield, Clock } from 'lucide-react'

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Zap className="w-12 h-12 text-blue-600 mr-4" />
            <h1 className="text-6xl font-bold text-gray-900">ShareZidi v3.0</h1>
          </div>
          <p className="text-2xl text-gray-600 mb-8">Ultimate P2P File Transfer</p>
          <p className="text-lg text-gray-500 max-w-3xl mx-auto mb-8">
            Revolutionary peer-to-peer file transfer with WebRTC technology. 
            Send files directly between devices with lightning-fast speeds and zero server storage.
          </p>
          <Link
            to="/transfer"
            className="btn btn-primary px-8 py-4 text-xl font-semibold"
          >
            Start Transferring
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <div className="card p-6 text-center">
            <Zap className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">WebRTC P2P</h3>
            <p className="text-gray-600">
              Direct device-to-device transfers with WebRTC technology for maximum speed and security.
            </p>
          </div>

          <div className="card p-6 text-center">
            <Smartphone className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Mobile Optimized</h3>
            <p className="text-gray-600">
              Perfect for mobile devices with touch-friendly interface and battery optimization.
            </p>
          </div>

          <div className="card p-6 text-center">
            <Monitor className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Cross-Platform</h3>
            <p className="text-gray-600">
              Works seamlessly between iOS, Android, Windows, Mac, and Linux devices.
            </p>
          </div>

          <div className="card p-6 text-center">
            <Wifi className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Network Adaptive</h3>
            <p className="text-gray-600">
              Automatically adapts to WiFi, cellular, and LAN connections for optimal performance.
            </p>
          </div>

          <div className="card p-6 text-center">
            <Shield className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Zero Storage</h3>
            <p className="text-gray-600">
              Files never touch our servers - they go directly between your devices.
            </p>
          </div>

          <div className="card p-6 text-center">
            <Clock className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-time Progress</h3>
            <p className="text-gray-600">
              Live progress tracking with speed, ETA, and transfer statistics.
            </p>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Performance Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">100MB/s+</div>
              <div className="text-lg text-gray-600 mb-1">WebRTC P2P</div>
              <div className="text-sm text-gray-500">Direct device connection</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">50MB/s+</div>
              <div className="text-lg text-gray-600 mb-1">Direct TCP</div>
              <div className="text-sm text-gray-500">LAN optimization</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">25MB/s+</div>
              <div className="text-lg text-gray-600 mb-1">WebSocket</div>
              <div className="text-sm text-gray-500">Server relay</div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Files</h3>
              <p className="text-gray-600">
                Choose files from your device or drag and drop them into the interface.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Choose Device</h3>
              <p className="text-gray-600">
                Select the target device from the list of available devices on your network.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Transfer</h3>
              <p className="text-gray-600">
                Files transfer directly between devices with real-time progress tracking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}




