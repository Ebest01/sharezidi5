import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ShareZidiApp } from './components/ShareZidiApp'
import { LandingPage } from './pages/LandingPage'
import { TransferPage } from './pages/TransferPage'
import { DeviceList } from './components/DeviceList'
import { useWebRTC } from './hooks/useWebRTC'
import { useFileTransfer } from './hooks/useFileTransfer'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [devices, setDevices] = useState([])
  const [transfers, setTransfers] = useState([])
  
  const webrtc = useWebRTC()
  const fileTransfer = useFileTransfer()

  useEffect(() => {
    // Initialize WebRTC connection
    webrtc.connect()
    
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isMobile) {
      // Request wake lock for mobile
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen')
      }
    }
  }, [])

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/transfer" element={
            <TransferPage 
              isConnected={isConnected}
              devices={devices}
              transfers={transfers}
              webrtc={webrtc}
              fileTransfer={fileTransfer}
            />
          } />
        </Routes>
      </div>
    </Router>
  )
}

export default App




