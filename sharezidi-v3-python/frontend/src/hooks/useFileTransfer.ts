import { useState, useEffect, useCallback } from 'react'

interface FileTransfer {
  id: string
  file: File
  receiverId: string
  progress: number
  speed: number
  eta: number
  status: 'pending' | 'active' | 'completed' | 'failed'
  useWebRTC: boolean
  startTime?: number
  bytesTransferred: number
}

interface TransferStats {
  totalTransfers: number
  completedTransfers: number
  totalBytes: number
  averageSpeed: number
}

export const useFileTransfer = () => {
  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const [stats, setStats] = useState<TransferStats>({
    totalTransfers: 0,
    completedTransfers: 0,
    totalBytes: 0,
    averageSpeed: 0
  })
  const [isConnected, setIsConnected] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [])

  const connectWebSocket = useCallback(() => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const wsUrl = `ws://localhost:3000/ws/${clientId}?device_type=desktop&supports_webrtc=true&supports_p2p=true`
    
    const websocket = new WebSocket(wsUrl)
    
    websocket.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setWs(websocket)
    }
    
    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleWebSocketMessage(message)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      setWs(null)
    }
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }
  }, [])

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'pong':
        console.log('Pong received')
        break
        
      case 'incoming_transfer':
        handleIncomingTransfer(message)
        break
        
      case 'incoming_webrtc_transfer':
        handleIncomingWebRTCTransfer(message)
        break
        
      case 'transfer_started':
        handleTransferStarted(message)
        break
        
      case 'webrtc_transfer_started':
        handleWebRTCTransferStarted(message)
        break
        
      case 'progress_update':
        handleProgressUpdate(message)
        break
        
      case 'transfer_completed':
        handleTransferCompleted(message)
        break
        
      case 'error':
        console.error('Transfer error:', message.message)
        break
        
      default:
        console.log('Unknown message type:', message.type)
    }
  }, [])

  const handleIncomingTransfer = useCallback((message: any) => {
    console.log('Incoming transfer:', message)
    // Handle incoming file transfer request
  }, [])

  const handleIncomingWebRTCTransfer = useCallback((message: any) => {
    console.log('Incoming WebRTC transfer:', message)
    // Handle incoming WebRTC transfer request
  }, [])

  const handleTransferStarted = useCallback((message: any) => {
    console.log('Transfer started:', message)
    // Update transfer status
  }, [])

  const handleWebRTCTransferStarted = useCallback((message: any) => {
    console.log('WebRTC transfer started:', message)
    // Update WebRTC transfer status
  }, [])

  const handleProgressUpdate = useCallback((message: any) => {
    setTransfers(prev => prev.map(transfer => 
      transfer.id === message.transfer_id 
        ? { ...transfer, progress: message.progress }
        : transfer
    ))
  }, [])

  const handleTransferCompleted = useCallback((message: any) => {
    setTransfers(prev => prev.map(transfer => 
      transfer.id === message.transfer_id 
        ? { ...transfer, status: 'completed', progress: 100 }
        : transfer
    ))
  }, [])

  const sendFile = useCallback(async (file: File, receiverId: string, useWebRTC: boolean = true) => {
    if (!ws || !isConnected) {
      console.error('WebSocket not connected')
      return false
    }

    const transferId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const transfer: FileTransfer = {
      id: transferId,
      file,
      receiverId,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'pending',
      useWebRTC,
      startTime: Date.now(),
      bytesTransferred: 0
    }
    
    setTransfers(prev => [...prev, transfer])
    
    // Calculate file info
    const chunkSize = 64 * 1024 // 64KB
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      total_chunks: totalChunks,
      hash: await calculateFileHash(file)
    }
    
    // Send transfer start message
    const message = {
      type: 'file_transfer_start',
      transfer_id: transferId,
      receiver_id: receiverId,
      file_info: fileInfo,
      use_webrtc: useWebRTC
    }
    
    ws.send(JSON.stringify(message))
    
    return transferId
  }, [ws, isConnected])

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const cancelTransfer = useCallback((transferId: string) => {
    setTransfers(prev => prev.map(transfer => 
      transfer.id === transferId 
        ? { ...transfer, status: 'failed' }
        : transfer
    ))
  }, [])

  const clearCompletedTransfers = useCallback(() => {
    setTransfers(prev => prev.filter(transfer => transfer.status !== 'completed'))
  }, [])

  const getTransferStats = useCallback(() => {
    const totalTransfers = transfers.length
    const completedTransfers = transfers.filter(t => t.status === 'completed').length
    const totalBytes = transfers.reduce((sum, t) => sum + t.bytesTransferred, 0)
    const averageSpeed = transfers.length > 0 
      ? transfers.reduce((sum, t) => sum + t.speed, 0) / transfers.length 
      : 0
    
    return {
      totalTransfers,
      completedTransfers,
      totalBytes,
      averageSpeed
    }
  }, [transfers])

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s'
  }, [formatBytes])

  const formatETA = useCallback((eta: number): string => {
    if (eta === 0) return 'Unknown'
    const minutes = Math.floor(eta / 60)
    const seconds = Math.floor(eta % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  return {
    transfers,
    stats,
    isConnected,
    sendFile,
    cancelTransfer,
    clearCompletedTransfers,
    getTransferStats,
    formatBytes,
    formatSpeed,
    formatETA
  }
}
