import { useState, useEffect, useCallback } from 'react'

interface WebRTCConnection {
  pc: RTCPeerConnection | null
  dataChannel: RTCDataChannel | null
  isConnected: boolean
  connectionState: string
}

interface WebRTCTransfer {
  id: string
  file: File
  progress: number
  speed: number
  eta: number
  status: 'pending' | 'active' | 'completed' | 'failed'
}

export const useWebRTC = () => {
  const [connection, setConnection] = useState<WebRTCConnection>({
    pc: null,
    dataChannel: null,
    isConnected: false,
    connectionState: 'disconnected'
  })
  
  const [transfers, setTransfers] = useState<WebRTCTransfer[]>([])
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check WebRTC support
    const supported = !!(window.RTCPeerConnection && window.RTCDataChannel)
    setIsSupported(supported)
    
    if (supported) {
      initializeWebRTC()
    }
  }, [])

  const initializeWebRTC = useCallback(() => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    }

    const pc = new RTCPeerConnection(configuration)
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      setConnection(prev => ({
        ...prev,
        connectionState: pc.connectionState,
        isConnected: pc.connectionState === 'connected'
      }))
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to signaling server
        sendSignalingMessage({
          type: 'webrtc_ice_candidate',
          candidate: event.candidate
        })
      }
    }

    // Handle data channel
    pc.ondatachannel = (event) => {
      const channel = event.channel
      setupDataChannel(channel)
    }

    setConnection(prev => ({ ...prev, pc }))
  }, [])

  const setupDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log('WebRTC Data Channel opened')
      setConnection(prev => ({ ...prev, dataChannel: channel }))
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleDataChannelMessage(message)
      } catch (error) {
        console.error('Error parsing data channel message:', error)
      }
    }

    channel.onclose = () => {
      console.log('WebRTC Data Channel closed')
      setConnection(prev => ({ ...prev, dataChannel: null }))
    }
  }, [])

  const handleDataChannelMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'file_chunk':
        // Handle incoming file chunk
        console.log('Received file chunk:', message.chunk_index)
        break
      case 'transfer_progress':
        // Update transfer progress
        setTransfers(prev => prev.map(transfer => 
          transfer.id === message.transfer_id 
            ? { ...transfer, progress: message.progress }
            : transfer
        ))
        break
      default:
        console.log('Unknown data channel message:', message)
    }
  }, [])

  const connect = useCallback(async () => {
    if (!connection.pc) {
      initializeWebRTC()
    }
  }, [connection.pc, initializeWebRTC])

  const createOffer = useCallback(async (transferId: string) => {
    if (!connection.pc) return null

    try {
      // Create data channel
      const dataChannel = connection.pc.createDataChannel('file-transfer', {
        ordered: true
      })
      
      setupDataChannel(dataChannel)
      
      // Create offer
      const offer = await connection.pc.createOffer()
      await connection.pc.setLocalDescription(offer)
      
      return {
        sdp: offer.sdp,
        type: offer.type
      }
    } catch (error) {
      console.error('Error creating WebRTC offer:', error)
      return null
    }
  }, [connection.pc, setupDataChannel])

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!connection.pc) return null

    try {
      await connection.pc.setRemoteDescription(offer)
      const answer = await connection.pc.createAnswer()
      await connection.pc.setLocalDescription(answer)
      
      return {
        sdp: answer.sdp,
        type: answer.type
      }
    } catch (error) {
      console.error('Error handling WebRTC offer:', error)
      return null
    }
  }, [connection.pc])

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!connection.pc) return

    try {
      await connection.pc.setRemoteDescription(answer)
    } catch (error) {
      console.error('Error handling WebRTC answer:', error)
    }
  }, [connection.pc])

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!connection.pc) return

    try {
      await connection.pc.addIceCandidate(candidate)
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }, [connection.pc])

  const sendFile = useCallback(async (file: File, transferId: string) => {
    if (!connection.dataChannel || connection.dataChannel.readyState !== 'open') {
      console.error('Data channel not ready')
      return false
    }

    try {
      const chunkSize = 64 * 1024 // 64KB chunks
      const totalChunks = Math.ceil(file.size / chunkSize)
      
      // Add transfer to list
      const transfer: WebRTCTransfer = {
        id: transferId,
        file,
        progress: 0,
        speed: 0,
        eta: 0,
        status: 'active'
      }
      
      setTransfers(prev => [...prev, transfer])

      // Send file in chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)
        
        const chunkData = await chunk.arrayBuffer()
        
        const message = {
          type: 'file_chunk',
          transfer_id: transferId,
          chunk_index: i,
          total_chunks: totalChunks,
          data: Array.from(new Uint8Array(chunkData))
        }
        
        connection.dataChannel.send(JSON.stringify(message))
        
        // Update progress
        const progress = ((i + 1) / totalChunks) * 100
        setTransfers(prev => prev.map(t => 
          t.id === transferId 
            ? { ...t, progress }
            : t
        ))
        
        // Small delay to prevent overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Mark transfer as completed
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, status: 'completed', progress: 100 }
          : t
      ))
      
      return true
    } catch (error) {
      console.error('Error sending file:', error)
      return false
    }
  }, [connection.dataChannel])

  const sendSignalingMessage = useCallback((message: any) => {
    // This would typically send to your signaling server
    console.log('Signaling message:', message)
  }, [])

  return {
    connection,
    transfers,
    isSupported,
    connect,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    sendFile
  }
}




