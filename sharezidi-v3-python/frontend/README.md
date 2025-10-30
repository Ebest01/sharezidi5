# ShareZidi v3.0 Frontend

Revolutionary P2P file transfer frontend with WebRTC support, built with React and TypeScript.

## 🚀 Features

- **WebRTC P2P Support** - Direct device-to-device transfers
- **Mobile Optimized** - Touch-friendly interface for mobile devices
- **Cross-Platform** - Works on iOS, Android, Windows, Mac, Linux
- **Real-time Progress** - Live transfer tracking with speed and ETA
- **PWA Support** - Install as native app on mobile devices
- **Drag & Drop** - Intuitive file selection interface
- **Device Discovery** - Automatic device detection and connection

## 🛠️ Technology Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **WebRTC API** - Direct P2P connections
- **Service Worker** - Background sync and caching

## 📱 Mobile Features

- **Touch Gestures** - Swipe, pinch, and tap interactions
- **Wake Lock** - Prevents screen sleep during transfers
- **Background Sync** - Continues transfers when app is backgrounded
- **Push Notifications** - Transfer status updates
- **Offline Support** - Works without internet (LAN only)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern browser with WebRTC support

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

### Production Build

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
frontend/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker
├── src/
│   ├── components/
│   │   ├── ShareZidiApp.tsx   # Main app component
│   │   └── DeviceList.tsx     # Device selection
│   ├── hooks/
│   │   ├── useWebRTC.ts       # WebRTC connection logic
│   │   └── useFileTransfer.ts # File transfer management
│   ├── pages/
│   │   ├── LandingPage.tsx    # Landing page
│   │   └── TransferPage.tsx   # Transfer interface
│   ├── App.tsx                # Main app router
│   ├── main.tsx              # App entry point
│   └── index.css             # Global styles
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🔧 Configuration

### Vite Configuration

The frontend is configured to proxy API calls to the Python backend:

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:8003',
    '/ws': 'ws://localhost:8003'
  }
}
```

### Tailwind CSS

Custom theme with ShareZidi branding:

```javascript
theme: {
  extend: {
    colors: {
      primary: { /* Blue color scheme */ },
      success: { /* Green color scheme */ }
    }
  }
}
```

## 📱 PWA Features

### Manifest

The app includes a PWA manifest for installation:

- **App Name**: ShareZidi v3.0
- **Theme Color**: Blue (#3b82f6)
- **Display**: Standalone
- **Orientation**: Portrait-primary

### Service Worker

Background capabilities:

- **Caching** - Offline support
- **Background Sync** - Continue transfers when backgrounded
- **Push Notifications** - Transfer status updates

## 🌐 WebRTC Integration

### Connection Flow

1. **Device Discovery** - Find available devices
2. **Signaling** - Exchange connection offers/answers
3. **ICE Candidates** - Establish direct connection
4. **Data Channel** - Stream file chunks
5. **Progress Tracking** - Real-time updates

### Browser Support

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ✅ Edge 80+
- ✅ Mobile browsers

## 📊 Performance

### Transfer Speeds

| Connection Type | Speed | Latency | Use Case |
|----------------|-------|---------|----------|
| **WebRTC P2P** | 100MB/s+ | 10-20ms | Same network |
| **WebRTC Relay** | 50MB/s+ | 50-100ms | Different networks |
| **WebSocket** | 25MB/s+ | 100-200ms | Fallback |

### Mobile Optimization

- **Chunk Size**: 64KB (optimized for mobile)
- **Concurrent Streams**: 1-4 (network dependent)
- **Battery Saver**: Adaptive chunking
- **Wake Lock**: Prevents sleep during transfer

## 🔒 Security

- **Zero Server Storage** - Files never touch servers
- **Direct P2P** - No intermediate storage
- **Encrypted Channels** - WebRTC data channels are encrypted
- **Local Network** - Works on trusted networks

## 🚀 Deployment

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 📱 Mobile Installation

1. **Open in mobile browser**
2. **Tap "Add to Home Screen"**
3. **Install as native app**
4. **Enable notifications**

## 🐛 Troubleshooting

### WebRTC Not Working

- Check browser support
- Ensure HTTPS in production
- Verify STUN servers are accessible

### Transfer Fails

- Check network connectivity
- Verify devices are on same network
- Check firewall settings

### Mobile Issues

- Enable wake lock permission
- Check battery optimization settings
- Ensure stable network connection

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

**ShareZidi v3.0 Frontend** - The ultimate P2P file transfer experience! 🚀




