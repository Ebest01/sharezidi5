import React from 'react'
import { ShareZidiApp } from '../components/ShareZidiApp'

interface TransferPageProps {
  isConnected: boolean
  devices: any[]
  transfers: any[]
  webrtc: any
  fileTransfer: any
}

export const TransferPage: React.FC<TransferPageProps> = (props) => {
  return <ShareZidiApp {...props} />
}




