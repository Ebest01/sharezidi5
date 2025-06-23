import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import GoogleLoginButton from './components/GoogleLoginButton';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AppLayout from './AppLayout';
import JSZip from 'jszip';

/*****************************************************************
 * 1.  SOCKET‑IO INITIALISATION                                   *
 *****************************************************************/
// give every tab a short, friendly 3‑digit id (e.g. "844")
const userId = ('' + Math.random()).slice(2, 5);

const socket = io('https://app.share.netzidi.com', {
  path        : '/socket.io',
  transports  : ['websocket', 'polling'],
  pingInterval: 5000,
  pingTimeout : 20000
});

// expose for quick console debugging
window.socket = socket;

/*****************************************************************
 * 2.  EXTENSION ‑> ICON LOOK‑UP                                  *
 *****************************************************************/
const EXT_GROUPS = {
  doc : ["doc", "docx", "odt", "wps", "rtf", "txt", "pdf"],
  video : ["mp4", "m4v", "mov", "avi", "mkv", "flv", "webm", "wmv", "mpeg", "mpg"],
  audio : ["mp3", "wav", "aac", "flac", "ogg", "oga", "wma", "alac", "aiff"],
  xls  : ["xls", "xlsx", "xlsm", "csv", "tsv", "ods", "numbers"],
  presentation : ["ppt", "pptx", "pps", "ppsx", "odp", "key"],
  archive : ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  executable : ["exe", "msi", "apk", "app", "dmg", "bin", "sh", "bat"],
  code : ["js", "ts", "py", "java", "c", "cpp", "cs", "rb", "php", "go", "rs", "json", "htm", "html", "xhtml", "htmlx", "shtml", "css", "jsp", "asp", "aspx"],
  database : ["sql", "sqlite", "db", "mdb", "accdb"],
  pdf : ["pdf"]
};

const EXT_TO_GROUP = (() => {
  const map = {};
  for (const [group, list] of Object.entries(EXT_GROUPS)) {
    list.forEach(ext => { map[ext] = group; });
  }
  return map;
})();

const ICON_BASE = 'https://www.netzidi.com/images/icons/ext-groups';

/*****************************************************************
 * 3.  MAIN REACT COMPONENT                                       *
 *****************************************************************/
function App () {
  /* ———————————  state  ——————————— */
  const [devices,          setDevices]          = useState([]);
  const [selectedFiles,    setSelectedFiles]    = useState([]);
  const [transferProgress, setTransferProgress] = useState(0);
  const [isTransferring,   setIsTransferring]   = useState(false);
  const [receivingFile,    setReceivingFile]    = useState(null);
  const [receivedChunks,   setReceivedChunks]   = useState([]);
  const [sendStatus,       setSendStatus]       = useState('');
  const [receiveStatus,    setReceiveStatus]    = useState('');
  const [error,            setError]            = useState('');
  const [disconnected,     setDisconnected]     = useState(false);
  const [disconnectReason, setDisconnectReason] = useState('');
  const [isDragging,       setIsDragging]       = useState(false);
  const [currentSendingFile, setCurrentSendingFile] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [user, setUser] = useState(null);
  const [transferSpeed, setTransferSpeed] = useState('');
  const transferMetricsRef = useRef(new TransferMetrics());
  const [transfersInProgress, setTransfersInProgress] = useState({});
  const [multiFileTransfer, setMultiFileTransfer] = useState(null); // { from: 'deviceId', currentFile: 1, totalFiles: 5 }

  /* refs */
  const receivingFileRef  = useRef(null);
  const receivedChunksRef = useRef([]);
  const fileInputRef      = useRef(null);
  const [pendingTarget, setPendingTarget] = useState(null);
  const fileStreamHandleRef = useRef(null);
  const fileWritableStreamRef = useRef(null);
  const userCancelledRef = useRef(false);
  const wakeLockRef = useRef(null);
  const audioContextRef = useRef(null);
  const transferTimeoutRef = useRef(null);
  const lastChunkTimeRef = useRef(0);
  const expectedChunksRef = useRef(0);
  const receivedChunkCountRef = useRef(0);
  const useMemoryFallback = useRef(false);
  
  /* keep refs in sync */
  useEffect(() => { receivingFileRef.current  = receivingFile;  }, [receivingFile]);
  useEffect(() => { receivedChunksRef.current = receivedChunks; }, [receivedChunks]);
  

  /* ———————————  Wake Lock & Keep-Alive Functions  ——————————— */
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[TEST14] Wake Lock acquired');
        
        // Re-acquire wake lock if page becomes visible again
        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState === 'visible' && (isTransferring || receivingFile)) {
            try {
              wakeLockRef.current = await navigator.wakeLock.request('screen');
              console.log('[TEST14] Wake Lock re-acquired after visibility change');
            } catch (err) {
              console.log('[TEST14] Failed to re-acquire wake lock:', err);
            }
          }
        });
      }
    } catch (err) {
      console.log('[TEST14] Wake Lock failed:', err);
    }
    //Wake lock system ends here.
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('[TEST14] Wake Lock released');
    }
  };

  // iOS-specific: Use Audio Context to prevent sleep
  const startAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create a silent audio loop
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0; // Silent
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      oscillator.start();
      
      console.log('[TEST14] Silent audio started for iOS keep-alive');
    }
  };

  // The audio context is used to keep the device awake.
  // It is started when the transfer starts and stopped when the transfer completes.
  // It is a silent audio loop that plays in the background.
  // It is a workaround for the fact that iOS does not support the wake lock API.

  const stopAudioContext = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('[TEST14] Audio context stopped');
    }
  };

  // Monitor transfer health
  const startTransferMonitoring = () => {
    lastChunkTimeRef.current = Date.now();
    transferTimeoutRef.current = setTimeout(checkTransferHealth, 5000);
  };

  const stopTransferMonitoring = () => {
    if (transferTimeoutRef.current) {
      clearTimeout(transferTimeoutRef.current);
      transferTimeoutRef.current = null;
    }
  };
  
  // Add cooldown for resume requests to prevent flooding
  const requestResumeWithCooldown = (() => {
    let lastResumeRequest = 0;
    const COOLDOWN_MS = 5000; // 5 seconds cooldown
    // This is a cooldown to prevent the receiver from requesting a resume too often.
    // It is a workaround for the fact that the receiver may not be able to handle the resume request immediately.
    return () => {
      const now = Date.now();
      if (now - lastResumeRequest >= COOLDOWN_MS) {
        lastResumeRequest = now;
        if (receivingFileRef.current) {
          socket.emit('resume-transfer', {
            toUserId: receivingFileRef.current.from,
            fromChunk: receivedChunkCountRef.current,
            fileName: receivingFileRef.current.name
          });
        }
      }
    };
  })();

  /* ———————————  socket wiring  ——————————— */
  useEffect(() => {
    // open the connection if it isn't already
    if (!socket.connected) socket.connect();

    socket.on('connect', () => {
      setDisconnected(false);
      setDisconnectReason('');
      setMySocketId(socket.id);
      console.log('[CLIENT] Connected. userId:', userId, 'socket.id:', socket.id);
      socket.emit('register', userId);
      if (receivingFileRef.current) {
        console.log('[TEST14] 🔄 Reconnected during file transfer, requesting resume...');
        setTimeout(() => {
          socket.emit('resume-transfer', {
            toUserId: receivingFileRef.current.from,
            fromChunk: receivedChunkCountRef.current,
            fileName: receivingFileRef.current.name
          });
        }, 1000);
      }
    });

    socket.on('users', list => {
      setDevices(
        list
          .filter(id => id !== userId)
          .map(id => ({ id, name: id, type: 'pc' }))
      );
    });

    socket.on('transfer-request', ({ from, fileInfo }) => {
      console.log(`[TEST14] 📥 Incoming: ${fileInfo.name} (${(fileInfo.size/1024/1024).toFixed(2)}MB, ${fileInfo.totalChunks} chunks)`);
      
      // Large file warning
      if (fileInfo.size / (1024 * 1024) > 300) {
        const proceed = window.confirm(
          `⚠️ LARGE FILE WARNING\n\n` +
          `File: ${fileInfo.name}\n` +
          `Size: ${(fileInfo.size/1024/1024).toFixed(1)}MB\n\n` +
          `Files over 300MB may fail in browser.\n` +
          `Continue anyway?`
        );
        
        if (!proceed) {
          socket.emit('transfer-rejected', { 
            toUserId: from, 
            reason: 'File too large for browser transfer' 
          });
          return;
        }
      }
      
      // Reset all state
      userCancelledRef.current = false;
      receivedChunkCountRef.current = 0;
      receivedChunksRef.current = null;
      
      // Force garbage collection before starting
      if (window.gc) {
        window.gc();
        console.log('[TEST14] 🗑️ Pre-transfer garbage collection');
      }
      
      // Start transfer
      requestWakeLock();
      startAudioContext();
      startTransferMonitoring();
      transferMetricsRef.current.reset();
      
      setReceivingFile({ from, ...fileInfo });
      setReceiveStatus(`[TEST14] Starting: ${fileInfo.name} (${(fileInfo.size/1024/1024).toFixed(2)}MB)`);
      setReceivedChunks([]);
      setTransferProgress(0);
    });
    
    // Handle resume requests from receivers
    socket.on('resume-transfer', ({ from, fromChunk, fileName }) => {
      console.log(`[TEST14] Resume request from ${from} for ${fileName} starting from chunk ${fromChunk}`);
      // Find the current transfer for this device
      const currentTransfer = transfersInProgress[from];
      if (currentTransfer && currentTransfer.isTransferring && currentTransfer.currentFile.name === fileName) {
        console.log(`[TEST14] Resuming transfer from chunk ${fromChunk}`);
        // Reset the current chunk counter to resume point
        // This assumes you have a way to update currentChunk in the closure
        // For robust code, you may want to refactor handleTransfer to allow this
        // For now, just log and let the user know
        // (Implementing full resumable logic may require more refactoring)
      }
    });
    
    // Handle transfer completion notification
    socket.on('transfer-complete', ({ from, fileName }) => {
      console.log('[TEST14] Sender completed transfer:', fileName, 'from:', from);
      // This lets the receiver know the sender is done
    });
    
    // Handle keep-alive from sender
    socket.on('keep-alive', ({ from }) => {
      console.log('[TEST14] Keep-alive received from:', from);
      // This helps maintain the connection
    });

   socket.on('file-chunk', async (receivedData) => {
    const { from, chunk, progress, chunkIndex, totalChunks } = receivedData;
    
    // Basic validation
    if (!receivingFileRef.current || from !== receivingFileRef.current.from || userId === from) {
      return;
    }
    
    // Update last chunk time
    lastChunkTimeRef.current = Date.now();
    
    // Handle binary data
    let chunkData;
    if (chunk instanceof ArrayBuffer) {
      chunkData = new Uint8Array(chunk);
    } else if (chunk && chunk.type === 'Buffer' && Array.isArray(chunk.data)) {
      chunkData = new Uint8Array(chunk.data);
    } else {
      console.error('[TEST14] Unknown chunk format:', typeof chunk);
      return;
    }

    // Validate chunk index
    if (typeof chunkIndex !== 'number' || chunkIndex < 0 || chunkIndex >= totalChunks) {
      console.error(`[TEST14] Invalid chunk: ${chunkIndex}/${totalChunks}`);
      return;
    }

    // Initialize chunks array ONCE
    if (!receivedChunksRef.current || receivedChunksRef.current.length !== totalChunks) {
      console.log(`[TEST14] 🆕 Initializing array for ${totalChunks} chunks`);
      receivedChunksRef.current = new Array(totalChunks).fill(undefined);
      expectedChunksRef.current = totalChunks;
      receivedChunkCountRef.current = 0;
    }

    // STRICT DUPLICATE REJECTION
    if (receivedChunksRef.current[chunkIndex] !== undefined) {
      console.log(`[TEST14] 🚫 REJECTING duplicate chunk ${chunkIndex}`);
      return; // Stop processing duplicates completely
    }
    
    // Store NEW chunk
    receivedChunksRef.current[chunkIndex] = chunkData;
    receivedChunkCountRef.current++;
    
    // Log progress
    const progressPercent = (receivedChunkCountRef.current / totalChunks * 100);
    console.log(`[TEST14] ✅ NEW chunk ${chunkIndex} stored (${receivedChunkCountRef.current}/${totalChunks} = ${progressPercent.toFixed(1)}%)`);
    
    // Update UI
    setTransferProgress(progressPercent);
    setReceiveStatus(`[TEST14] Receiving... ${progressPercent.toFixed(1)}% (${receivedChunkCountRef.current}/${totalChunks} chunks)`);
    
    // Large file memory warning
    if (receivedChunkCountRef.current % 1000 === 0) {
      console.log(`[TEST14] 📊 Progress checkpoint: ${receivedChunkCountRef.current}/${totalChunks} chunks`);
      
      if (totalChunks > 5000 && receivedChunkCountRef.current > 3000) {
        console.warn('[TEST14] ⚠️ Large file - memory usage high');
      }
    }
    
    // Check completion
    if (receivedChunkCountRef.current === totalChunks) {
      console.log('[TEST14] 🎉 ALL CHUNKS RECEIVED! Creating file...');
      
      try {
        // Final verification
        let missingCount = 0;
        const missingChunks = [];
        
        for (let i = 0; i < totalChunks; i++) {
          if (receivedChunksRef.current[i] === undefined) {
            missingCount++;
            if (missingChunks.length < 20) { // Only log first 20 missing
              missingChunks.push(i);
            }
          }
        }
        
        if (missingCount > 0) {
          console.error(`[TEST14] ❌ Missing ${missingCount} chunks:`, missingChunks);
          setError(`Transfer incomplete: missing ${missingCount} chunks. Try again.`);
          
          // Reset for retry
          receivedChunksRef.current = null;
          receivedChunkCountRef.current = 0;
          return;
        }
        
        console.log('[TEST14] ✅ All chunks verified! Creating blob...');
        
        // Create blob from valid chunks
        const validChunks = receivedChunksRef.current.filter(chunk => chunk !== undefined);
        console.log(`[TEST14] 📁 Creating blob from ${validChunks.length} chunks...`);
        
        const blob = new Blob(validChunks, { 
          type: receivingFileRef.current.type || 'application/octet-stream' 
        });
        
        const expectedSize = receivingFileRef.current.size;
        const actualSize = blob.size;
        
        console.log(`[TEST14] 📁 Blob created: ${(actualSize/1024/1024).toFixed(2)}MB (expected: ${(expectedSize/1024/1024).toFixed(2)}MB)`);
        
        if (Math.abs(actualSize - expectedSize) > 1024) { // Allow 1KB difference
          console.warn(`[TEST14] ⚠️ Size mismatch: expected ${expectedSize}, got ${actualSize}`);
        }
        
        // Download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = receivingFileRef.current.name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        console.log(`[TEST14] 💾 Download triggered: ${receivingFileRef.current.name}`);
        
        // Cleanup download link
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log('[TEST14] 🗑️ Download link cleaned up');
        }, 1000);
        
        // Send confirmation
        socket.emit('transfer-confirmed', {
          toUserId: from,
          fileName: receivingFileRef.current.name,
          fileSize: actualSize
        });
        
        // Reset state
        setReceivingFile(null);
        setReceivedChunks([]);
        receivingFileRef.current = null;
        receivedChunksRef.current = null;
        receivedChunkCountRef.current = 0;
        setTransferProgress(0);
        setReceiveStatus(`[TEST14] ✅ File saved: ${receivingFileRef.current?.name}`);
        
        // Cleanup resources
        releaseWakeLock();
        stopAudioContext();
        stopTransferMonitoring();
        
        // Force garbage collection if available
        if (window.gc) {
          setTimeout(() => {
            window.gc();
            console.log('[TEST14] 🗑️ Forced garbage collection');
          }, 2000);
        }
        
      } catch (error) {
        console.error('[TEST14] ❌ Error creating file:', error);
        setError(`Failed to create file: ${error.message}`);
        
        // Reset state on error
        receivedChunksRef.current = null;
        receivedChunkCountRef.current = 0;
      }
    }
  });

    socket.on('connect_error', err => setError(`Socket connection error: ${err.message}`));
    socket.on('error',        err => setError(`Socket error: ${err.message}`));
    socket.on('disconnect',   reason => {
      setDisconnected(true);
      setDisconnectReason(reason);
      console.log('[CLIENT] Disconnected. Reason:', reason, 'userId:', userId, 'socket.id:', socket.id);
      if (receivingFileRef.current) {
        setReceiveStatus(`[TEST14] Connection lost (${reason}), attempting to reconnect...`);
      }
    });

    socket.on('reconnect', (attempt) => {
      console.log('[CLIENT] Reconnected. Attempt:', attempt, 'userId:', userId, 'socket.id:', socket.id);
      socket.emit('register', userId);
      console.log('[CLIENT] Sent register (reconnect):', userId, '->', socket.id);
    });

    // Add ping-pong handlers
    socket.on('ping', ({ from }) => {
      console.log('[PING] received from', from);
      // Reply with pong
      socket.emit('pong', { toUserId: from });
      console.log('[PONG] sent to', from);
    });
    socket.on('pong', ({ from }) => {
      console.log('[PONG] received from', from);
    });

    const handleOnline = () => {
      console.log('[TEST14] Network back online');
      if (receivingFileRef.current && !socket.connected) {
        setReceiveStatus('[TEST14] Network restored, reconnecting...');
        socket.connect();
      }
    };
    const handleOffline = () => {
      console.log('[TEST14] Network went offline');
      if (receivingFileRef.current) {
        setReceiveStatus('[TEST14] Network offline, waiting for connection...');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId, receivingFile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('[AUTH] User logged in:', firebaseUser.email, firebaseUser.displayName);
        // Store user info for nav bar (fail-safe for missing displayName)
        try {
          const userInfo = {
            name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || '',
          };
          localStorage.setItem('userInfo', JSON.stringify(userInfo));
        } catch (err) {
          console.error('Failed to store userInfo in localStorage:', err);
        }
      } else {
        console.log('[AUTH] User not logged in');
        localStorage.removeItem('userInfo');
      }
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  /* ———————————  helpers  ——————————— */
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setSendStatus('');
    }
    // Reset input so selecting the same file again works
    event.target.value = '';
  };

  /* ———————————  Transfer Optimization Utils  ——————————— */
  const getOptimalChunkSize = (fileSize) => {
    // Detect if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    // Detect connection type if available
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '3g';
    // MOBILE-SPECIFIC OPTIMIZATIONS
    if (isMobile) {
      if (isSlowConnection) {
        return 32 * 1024; // 32KB for slow mobile connections
      }
      if (fileSize < 10 * 1024 * 1024) return 64 * 1024;      // 64KB for small files
      if (fileSize < 50 * 1024 * 1024) return 128 * 1024;     // 128KB for medium files  
      if (fileSize < 200 * 1024 * 1024) return 256 * 1024;    // 256KB for large files
      return 512 * 1024; // 512KB max for very large files
    }
    // Desktop optimizations (existing logic)
    if (isSlowConnection) {
      return 32 * 1024; // 32KB for slow connections
    }
    if (fileSize < 10 * 1024 * 1024) return 128 * 1024;      // 128KB for small files
    if (fileSize < 100 * 1024 * 1024) return 256 * 1024;    // 256KB for medium files
    if (fileSize < 500 * 1024 * 1024) return 512 * 1024;    // 512KB for large files
    return 1024 * 1024; // 1MB for very large files
  };

  // MOBILE-OPTIMIZED getParallelChunkCount
  const getParallelChunkCount = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (isMobile) {
      if (connection?.effectiveType === '4g') return 2;
      if (connection?.effectiveType === '3g') return 1;
      if (connection?.effectiveType === '2g') return 1;
      return 1;
    }
    if (connection?.effectiveType === '4g') return 4;
    if (connection?.effectiveType === '3g') return 3;
    if (connection?.effectiveType === '2g') return 1;
    return 2;
  };

  // Transfer metrics tracking
  class TransferMetrics {
    constructor() {
      this.reset();
    }
    
    reset() {
      this.startTime = Date.now();
      this.bytesTransferred = 0;
      this.lastUpdateTime = Date.now();
      this.lastBytesTransferred = 0;
      this.speeds = [];
    }
    
    updateProgress(bytesTransferred) {
      this.bytesTransferred = bytesTransferred;
      const now = Date.now();
      const timeDiff = now - this.lastUpdateTime;
      
      if (timeDiff >= 1000) { // Update every second
        const bytesDiff = bytesTransferred - this.lastBytesTransferred;
        const currentSpeed = (bytesDiff / timeDiff) * 1000; // bytes per second
        this.speeds.push(currentSpeed);
        
        // Keep only last 5 readings for moving average
        if (this.speeds.length > 5) this.speeds.shift();
        
        this.lastUpdateTime = now;
        this.lastBytesTransferred = bytesTransferred;
      }
    }
    
    getCurrentSpeed() {
      if (this.speeds.length === 0) return 0;
      return this.speeds.reduce((a, b) => a + b, 0) / this.speeds.length;
    }
    
    getAverageSpeed() {
      const totalTime = Date.now() - this.startTime;
      return totalTime > 0 ? (this.bytesTransferred / totalTime) * 1000 : 0;
    }
    
    getFormattedSpeed() {
      const speed = this.getCurrentSpeed();
      if (speed < 1024) return `${speed.toFixed(0)} B/s`;
      if (speed < 1024 * 1024) return `${(speed / 1024).toFixed(1)} KB/s`;
      return `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  }

  const handleTransfer = (targetDevice) => {
    if (!user) {
      console.warn('[AUTH] Blocked file send: user not logged in');
      alert('Please sign in to use ShareZidi!');
      return;
    }
    if (!selectedFiles.length) return;

    console.log(`[TEST14] 🚀 Starting transfer of ${selectedFiles.length} files to device ${targetDevice.id}`);

    setTransfersInProgress(prev => ({
      ...prev,
      [targetDevice.id]: {
        isTransferring: true,
        currentFile: selectedFiles[0],
        progress: 0,
        status: `[TEST14] Preparing to send ${selectedFiles.length} file(s)...`,
        error: null,
        fileIndex: 0,
        totalFiles: selectedFiles.length
      }
    }));

    requestWakeLock();
    startAudioContext();

    const beforeUnloadHandler = (e) => {
      const currentTransfer = transfersInProgress[targetDevice.id];
      if (currentTransfer && currentTransfer.isTransferring) {
        e.preventDefault();
        e.returnValue = 'File transfer in progress. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    let fileIndex = 0;
    let waitingForConfirmation = false;

    const sendNextFile = async () => {
      console.log(`[TEST14] 📋 sendNextFile() called - fileIndex: ${fileIndex}, total: ${selectedFiles.length}`);
      if (fileIndex >= selectedFiles.length) {
        console.log('[TEST14] 🎉 ALL FILES COMPLETED!');
        setTransfersInProgress(prev => ({
          ...prev,
          [targetDevice.id]: {
            isTransferring: false,
            currentFile: null,
            progress: 100,
            status: `[TEST14] 🎉 All ${selectedFiles.length} files sent successfully!`,
            error: null,
            fileIndex: selectedFiles.length,
            totalFiles: selectedFiles.length
          }
        }));
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        releaseWakeLock();
        stopAudioContext();
        setTimeout(() => {
          setTransfersInProgress(prev => ({
            ...prev,
            [targetDevice.id]: {
              isTransferring: false,
              currentFile: null,
              progress: 0,
              status: '',
              error: null
            }
          }));
        }, 5000);
        return;
      }
      const file = selectedFiles[fileIndex];
      console.log(`[TEST14] 📤 Starting file ${fileIndex + 1}/${selectedFiles.length}: ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`);
      setTransfersInProgress(prev => ({
        ...prev,
        [targetDevice.id]: {
          isTransferring: true,
          currentFile: file,
          progress: 0,
          status: `[TEST14] Sending file ${fileIndex + 1}/${selectedFiles.length}: ${file.name}`,
          error: null,
          fileIndex: fileIndex,
          totalFiles: selectedFiles.length
        }
      }));
      const chunkSize = getOptimalChunkSize(file.size);
      const parallelCount = getParallelChunkCount();
      const totalChunks = Math.ceil(file.size / chunkSize);
      console.log('[TEST14] Transfer settings:', {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        chunkSize: `${(chunkSize / 1024).toFixed(0)} KB`,
        totalChunks,
        parallelCount
      });
      let currentChunk = 0;
      let activeTransfers = 0;
      let isPaused = false;
      let fileTransferCompleted = false;
      const handleVisibilityChange = () => {
        if (document.hidden) {
          isPaused = true;
          console.log('[TEST14] Page hidden, pausing transfer');
        } else {
          isPaused = false;
          console.log('[TEST14] Page visible, resuming transfer');
          while (activeTransfers < parallelCount && currentChunk < totalChunks && !fileTransferCompleted) {
            readAndSendChunk();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      const readAndSendChunk = () => {
        if (isPaused || fileTransferCompleted) {
          console.log(`[TEST14] Skipping chunk - paused: ${isPaused}, completed: ${fileTransferCompleted}`);
          return;
        }
        const chunkIndex = currentChunk++;
        activeTransfers++;
        console.log(`[TEST14] 📦 Starting chunk ${chunkIndex + 1}/${totalChunks}, activeTransfers: ${activeTransfers}`);
        if (chunkIndex >= totalChunks) {
          activeTransfers--;
          console.log(`[TEST14] ⚠️ Chunk index ${chunkIndex} >= totalChunks ${totalChunks}, activeTransfers now: ${activeTransfers}`);
          // Check if this was the last active transfer for this file
          if (activeTransfers === 0 && !fileTransferCompleted) {
            fileTransferCompleted = true;
            console.log(`[TEST14] ✅ FILE COMPLETED: ${file.name} (${fileIndex + 1}/${selectedFiles.length})`);
            console.log(`[TEST14] 📊 Final stats - totalChunks: ${totalChunks}, currentChunk: ${currentChunk}, activeTransfers: ${activeTransfers}`);
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: true,
                currentFile: file,
                progress: 100,
                status: `[TEST14] ✅ File ${fileIndex + 1}/${selectedFiles.length} sent: ${file.name}`,
                error: null,
                fileIndex: fileIndex,
                totalFiles: selectedFiles.length
              }
            }));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // Move to next file
            fileIndex++;
            console.log(`[TEST14] 🔄 Moving to next file - new fileIndex: ${fileIndex}`);
            setTimeout(() => {
              console.log(`[TEST14] 🚀 Calling sendNextFile for fileIndex: ${fileIndex}`);
              sendNextFile();
            }, 2000);
          }
          return;
        }
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const emitPayload = {
              toUserId: targetDevice.id,
              chunk: e.target.result,
              progress: ((chunkIndex + 1) / totalChunks) * 100,
              chunkIndex: chunkIndex,
              totalChunks: totalChunks
            };
            console.log(`[TEST14][SEND] 📦 Chunk ${chunkIndex + 1}/${totalChunks} for file: ${file.name}`);
            socket.emit('file-chunk', emitPayload);
            transferMetricsRef.current.updateProgress(end - start);
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: true,
                currentFile: file,
                progress: ((chunkIndex + 1) / totalChunks) * 100,
                status: `[TEST14] Sending file ${fileIndex + 1}/${selectedFiles.length}: ${file.name}... ${(((chunkIndex + 1) / totalChunks) * 100).toFixed(1)}%`,
                error: null,
                fileIndex: fileIndex,
                totalFiles: selectedFiles.length
              }
            }));
            activeTransfers--;
            console.log(`[TEST14] 📤 Chunk ${chunkIndex + 1} sent, activeTransfers now: ${activeTransfers}, currentChunk: ${currentChunk}`);
            // IMPORTANT: Check if we just completed the last chunk
            if (chunkIndex + 1 === totalChunks && activeTransfers === 0 && !fileTransferCompleted) {
              fileTransferCompleted = true;
              console.log(`[TEST14] ✅ LAST CHUNK COMPLETED: ${file.name} (${fileIndex + 1}/${selectedFiles.length})`);
              setTransfersInProgress(prev => ({
                ...prev,
                [targetDevice.id]: {
                  isTransferring: true,
                  currentFile: file,
                  progress: 100,
                  status: `[TEST14] ✅ File ${fileIndex + 1}/${selectedFiles.length} sent: ${file.name}`,
                  error: null,
                  fileIndex: fileIndex,
                  totalFiles: selectedFiles.length
                }
              }));
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              // Move to next file
              fileIndex++;
              console.log(`[TEST14] 🔄 Moving to next file - new fileIndex: ${fileIndex}`);
              setTimeout(() => {
                console.log(`[TEST14] 🚀 Calling sendNextFile for fileIndex: ${fileIndex}`);
                sendNextFile();
              }, 2000);
              return; // Don't start more chunks
            }
            // Start next chunk if we have capacity and chunks remaining
            if (activeTransfers < parallelCount && currentChunk < totalChunks && !fileTransferCompleted) {
              if ('requestIdleCallback' in window) {
                requestIdleCallback(() => readAndSendChunk(), { timeout: 50 });
              } else {
                setTimeout(readAndSendChunk, 10);
              }
            }
          } catch (err) {
            console.error('[TEST14] Error sending chunk:', err);
            fileTransferCompleted = true;
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: false,
                currentFile: null,
                progress: 0,
                status: '',
                error: 'Error sending file: ' + err.message
              }
            }));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', beforeUnloadHandler);
          }
        };
        reader.onerror = (err) => {
          console.error('[TEST14] FileReader error:', err);
          fileTransferCompleted = true;
          setTransfersInProgress(prev => ({
            ...prev,
            [targetDevice.id]: {
              isTransferring: false,
              currentFile: null,
              progress: 0,
              status: '',
              error: 'FileReader error: ' + err.message
            }
          }));
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('beforeunload', beforeUnloadHandler);
        };
        reader.readAsArrayBuffer(chunk);
      };
      console.log('[TEST14][SEND] 📡 Sending transfer-request for:', file.name);
      socket.emit('transfer-request', {
        toUserId: targetDevice.id,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          totalChunks: totalChunks,
          chunkSize: chunkSize,
          fileIndex: fileIndex,
          totalFiles: selectedFiles.length
        }
      });
      setTimeout(() => {
        console.log(`[TEST14] 🚀 Starting ${parallelCount} parallel transfers for: ${file.name}`);
        for (let i = 0; i < parallelCount && currentChunk < totalChunks; i++) {
          readAndSendChunk();
        }
      }, 200);
    };
    console.log('[TEST14] 🎬 Starting multi-file transfer...');
    sendNextFile();
  };
  
  const handleDragOver  = e => { e.preventDefault(); setIsDragging(true);  };
  const handleDragLeave = () =>  { setIsDragging(false);                 };
  const handleDrop      = e => {
    if (!user) {
      console.warn('[AUTH] Blocked drag-and-drop: user not logged in');
      alert('Please sign in to use ShareZidi!');
      return;
    }
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) { setSelectedFiles(prev => [...prev, ...files]); setSendStatus(''); }
  };

  const openFileDialog = () => {
    if (!user) {
      console.warn('[AUTH] Blocked file dialog: user not logged in');
      alert('Please sign in to use ShareZidi!');
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const removeFile = idx => setSelectedFiles(files => files.filter((_, i) => i !== idx));

  const getFileThumbnail = file => {
    if (file.type?.startsWith('image/')) return URL.createObjectURL(file);
    const ext   = file.name.split('.').pop().toLowerCase();
    const group = EXT_TO_GROUP[ext] || 'unknown';
    return `${ICON_BASE}/${group}.png`;
  };

  const formatFileName = (name, max = 25) => {
    if (name.length <= max) return name;
    const i = name.lastIndexOf('.');
    if (i === -1 || i === 0) return name.slice(0, max - 1) + '…';
    const ext = name.slice(i + 1);
    const room = max - ext.length - 2; // dot + ellipsis
    return name.slice(0, room) + '….' + ext;
  };

  const totalSizeMB = (selectedFiles.reduce((s, f) => s + f.size, 0) / 1048576).toFixed(2);

  const getDeviceIcon = type => {
    const valid = ['pc', 'phone', 'tablet'];
    return `https://www.netzidi.com/images/icons/devices/${valid.includes(type) ? type : 'pc'}.png`;
  };

  /* ———————————  Diagnostic state  ——————————— */
  const [diagnosticLog, setDiagnosticLog] = useState([]);
  const [allIds, setAllIds] = useState({});
  const [directPingTarget, setDirectPingTarget] = useState('');
  const [echoTarget, setEchoTarget] = useState('');
  const [echoMessage, setEchoMessage] = useState('Hello!');
  const [broadcastMessage, setBroadcastMessage] = useState('Hello everyone!');

  /* ———————————  Diagnostic helpers  ——————————— */
  const logDiag = (...args) => setDiagnosticLog(logs => [...logs, `[${new Date().toLocaleTimeString()}] ${args.join(' ')}`]);

  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit('heartbeat', { userId, socketId: socket.id });
      logDiag('Sent heartbeat', userId, socket.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    socket.onAny((event, ...args) => {
      logDiag('Event:', event, JSON.stringify(args));
    });
    return () => socket.offAny();
  }, []);

  useEffect(() => {
    socket.on('echo', ({ from, message }) => {
      logDiag('Received echo from', from, ':', message);
      // Reply with echo-reply
      socket.emit('echo-reply', { toUserId: from, message: 'Echo reply: ' + message });
      logDiag('Sent echo-reply to', from);
    });
    socket.on('echo-reply', ({ from, message }) => {
      logDiag('Received echo-reply from', from, ':', message);
    });
    socket.on('broadcast', ({ from, message }) => {
      logDiag('Received broadcast from', from, ':', message);
    });
    socket.on('server-time', ({ time }) => {
      logDiag('Received server time:', time);
    });
    socket.on('direct-ping', ({ from, message }) => {
      logDiag('Received direct-ping from', from, ':', message);
    });
    socket.on('heartbeat', ({ userId, socketId }) => {
      logDiag('Received heartbeat echo from server:', userId, socketId);
    });
    return () => {
      socket.off('echo');
      socket.off('echo-reply');
      socket.off('broadcast');
      socket.off('server-time');
      socket.off('direct-ping');
      socket.off('heartbeat');
    };
  }, []);

  const fetchAllIds = async () => {
    try {
      const res = await fetch('https://share.netzidi.com/debug/ids');
      const data = await res.json();
      setAllIds(data);
      logDiag('Fetched all IDs:', JSON.stringify(data));
    } catch (e) {
      logDiag('Failed to fetch IDs:', e.message);
    }
  };

  /* ———————————  JSX  (original UI, untouched)  ——————————— */
  // Add a flag to control diagnostic visibility
  const showDiagnostics = false;

  // Utility: Show large file warning modal if needed
  function showLargeFileWarningModal(onAcknowledge) {
    if (document.getElementById('largeFileModal')) return;
    const modal = document.createElement('div');
    modal.id = 'largeFileModal';
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.35);z-index:9998;"></div>
      <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:16px;box-shadow:0 8px 32px #0002;z-index:9999;min-width:320px;max-width:98vw;width:400px;padding:32px 24px 24px 24px;text-align:center;">
        <h3 style='color:#4a148c;'>Large File Warning</h3>
        <p style='color:#333;font-size:1.1em;'>Your browser or device may not support saving large files reliably.<br>Files over 200MB could fail to download or may slow down your device.<br><b>This is a limitation of your browser/device, not ShareZidi.</b></p>
        <a href='/help.html#large-files' target='_blank' style='color:#1976d2;'>Learn more</a>
        <br><br>
        <button id='ackLargeFileBtn' style='background:#4a148c;color:#fff;border:none;border-radius:8px;padding:10px 28px;font-size:1.1em;font-weight:600;cursor:pointer;'>OK, I understand</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('ackLargeFileBtn').onclick = () => {
      document.body.removeChild(modal);
      if (onAcknowledge) onAcknowledge();
    };
  }

  const handleZipAndSend = async (targetDevice) => {
    if (!user) {
      alert('Please sign in to use ShareZidi!');
      return;
    }
    if (!selectedFiles.length) return;

    setSendStatus('[TEST14] Zipping files...');
    try {
      const zip = new JSZip();
      for (const file of selectedFiles) {
        zip.file(file.name, file);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setSendStatus(`[TEST14] Zipping: ${metadata.percent.toFixed(1)}%`);
      });
      const zipFile = new File([zipBlob], 'ShareZidi_Files.zip', { type: 'application/zip' });
      setSendStatus('[TEST14] Zip complete. Sending...');
      // Use the same transfer logic as handleTransfer, but with just the zip file
      setTransfersInProgress(prev => ({
        ...prev,
        [targetDevice.id]: {
          isTransferring: true,
          currentFile: zipFile,
          progress: 0,
          status: `[TEST14] Sending ShareZidi_Files.zip...`,
          error: null
        }
      }));
      // Start keep-alive mechanisms for sender
      requestWakeLock();
      startAudioContext();
      // Prevent page from being unloaded during transfer
      const beforeUnloadHandler = (e) => {
        if (Object.values(transfersInProgress).some(t => t.isTransferring)) {
          e.preventDefault();
          e.returnValue = 'File transfer in progress. Are you sure you want to leave?';
        }
      };
      window.addEventListener('beforeunload', beforeUnloadHandler);
      // Send the zip file as a single file
      const file = zipFile;
      const chunkSize = getOptimalChunkSize(file.size);
      const parallelCount = getParallelChunkCount();
      const totalChunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      let activeTransfers = 0;
      let isPaused = false;
      const handleVisibilityChange = () => {
        if (document.hidden) {
          isPaused = true;
        } else {
          isPaused = false;
          while (activeTransfers < parallelCount && currentChunk < totalChunks) {
            readAndSendChunk();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      const readAndSendChunk = () => {
        if (isPaused) return;
        const chunkIndex = currentChunk++;
        activeTransfers++;
        if (chunkIndex >= totalChunks) {
          activeTransfers--;
          if (activeTransfers === 0) {
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: true,
                currentFile: file,
                progress: 100,
                status: `[TEST12] File sent: ShareZidi_Files.zip`,
                error: null
              }
            }));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            setTimeout(() => {
              setTransfersInProgress(prev => ({
                ...prev,
                [targetDevice.id]: {
                  isTransferring: false,
                  currentFile: null,
                  progress: 0,
                  status: '',
                  error: null
                }
              }));
            }, 500);
          }
          return;
        }
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const emitPayload = {
              toUserId: targetDevice.id,
              chunk: e.target.result,
              progress: ((chunkIndex + 1) / totalChunks) * 100,
              chunkIndex: chunkIndex,
              totalChunks: totalChunks
            };
            socket.emit('file-chunk', emitPayload);
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: true,
                currentFile: file,
                progress: ((chunkIndex + 1) / totalChunks) * 100,
                status: `[TEST12] Sending ShareZidi_Files.zip... ${(((chunkIndex + 1) / totalChunks) * 100).toFixed(1)}%`,
                error: null
              }
            }));
            activeTransfers--;
            if (activeTransfers < parallelCount && currentChunk < totalChunks) {
              if ('requestIdleCallback' in window) {
                requestIdleCallback(() => readAndSendChunk(), { timeout: 50 });
              } else {
                setTimeout(readAndSendChunk, 10);
              }
            }
          } catch (err) {
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: false,
                currentFile: null,
                progress: 0,
                status: '',
                error: 'Error sending zip: ' + err.message
              }
            }));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          }
        };
        reader.onerror = (err) => {
          setTransfersInProgress(prev => ({
            ...prev,
            [targetDevice.id]: {
              isTransferring: false,
              currentFile: null,
              progress: 0,
              status: '',
              error: 'FileReader error: ' + err.message
            }
          }));
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        reader.readAsArrayBuffer(chunk);
      };
      socket.emit('transfer-request', {
        toUserId: targetDevice.id,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          totalChunks: totalChunks,
          chunkSize: chunkSize,
          fileIndex: 0,
          totalFiles: selectedFiles.length
        }
      });
      for (let i = 0; i < parallelCount && currentChunk < totalChunks; i++) {
        readAndSendChunk();
      }
    } catch (err) {
      setSendStatus('[TEST12] Zip failed: ' + err.message);
    }
  };

  // LARGE FILE WARNING FOR MOBILE
  const showMobileLargeFileWarning = (fileSize, onProceed, onCancel) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLarge = fileSize > 100 * 1024 * 1024; // 100MB threshold for mobile
    if (isMobile && isLarge) {
      if (window.confirm(`This file is ${(fileSize/1024/1024).toFixed(1)}MB. Mobile transfers of large files may be slower and less reliable due to network limitations. Continue?`)) {
        onProceed();
      } else {
        onCancel();
      }
    } else {
      onProceed();
    }
  };

  // --- MOBILE ROBUSTNESS ENHANCEMENTS ---
  // 1. Aggressive Keep-Alive System
  const startAggressiveKeepAlive = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      requestWakeLock();
      startPersistentAudioContext();
      startMobileHeartbeat();
      handleMobileVisibilityChanges();
      monitorNetworkChanges();
      console.log('[TEST12] 🔋 Aggressive mobile keep-alive started');
    }
  };
  const startPersistentAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        for (let i = 0; i < 3; i++) {
          const oscillator = audioContextRef.current.createOscillator();
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
          oscillator.frequency.setValueAtTime(20000, audioContextRef.current.currentTime);
          oscillator.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          oscillator.start();
          setTimeout(() => {
            try {
              const newOscillator = audioContextRef.current.createOscillator();
              const newGainNode = audioContextRef.current.createGain();
              newGainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
              newOscillator.frequency.setValueAtTime(20000, audioContextRef.current.currentTime);
              newOscillator.connect(newGainNode);
              newGainNode.connect(audioContextRef.current.destination);
              newOscillator.start();
            } catch (e) {
              console.log('[TEST12] Audio context restart failed:', e);
            }
          }, 30000 * (i + 1));
        }
        console.log('[TEST12] 🎵 Persistent audio context started');
      } catch (e) {
        console.log('[TEST12] Audio context failed:', e);
      }
    }
  };
  const startMobileHeartbeat = () => {
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('mobile-heartbeat', {
          userId,
          timestamp: Date.now(),
          transferActive: !!receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)
        });
        console.log('[TEST12] 💓 Mobile heartbeat sent');
      }
    }, 2000);
    window.mobileHeartbeatInterval = heartbeatInterval;
  };
  const handleMobileVisibilityChanges = () => {
    let isBackground = false;
    let backgroundStartTime = 0;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isBackground = true;
        backgroundStartTime = Date.now();
        console.log('[TEST12] 📱 App went to background, maintaining transfer...');
        if (window.mobileHeartbeatInterval) {
          clearInterval(window.mobileHeartbeatInterval);
        }
        window.mobileHeartbeatInterval = setInterval(() => {
          if (socket.connected) {
            socket.emit('background-heartbeat', {
              userId,
              backgroundDuration: Date.now() - backgroundStartTime,
              transferActive: !!receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)
            });
            console.log('[TEST12] 🌙 Background heartbeat sent');
          }
        }, 1000);
      } else {
        if (isBackground) {
          const backgroundDuration = Date.now() - backgroundStartTime;
          console.log(`[TEST12] 📱 App returned to foreground after ${backgroundDuration}ms`);
          if (receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)) {
            console.log('[TEST12] 🔄 Transfer still active, resuming normal operation');
            socket.emit('request-transfer-status', { userId });
          }
          startMobileHeartbeat();
        }
        isBackground = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
  };
  const monitorNetworkChanges = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const handleNetworkChange = () => {
        console.log('[TEST12] 📶 Network changed:', {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        });
        if (receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)) {
          console.log('[TEST12] 🔄 Adjusting transfer parameters for network change');
          socket.emit('network-changed', {
            userId,
            networkInfo: {
              effectiveType: connection.effectiveType,
              downlink: connection.downlink,
              rtt: connection.rtt
            }
          });
        }
      };
      connection.addEventListener('change', handleNetworkChange);
    }
    const handleOnline = () => {
      console.log('[TEST12] 🌐 Network back online');
      if (receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)) {
        setReceiveStatus('[TEST12] Network restored, resuming transfer...');
        if (!socket.connected) {
          socket.connect();
        }
        setTimeout(() => {
          socket.emit('resume-all-transfers', { userId });
        }, 1000);
      }
    };
    const handleOffline = () => {
      console.log('[TEST12] 📵 Network went offline');
      if (receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)) {
        setReceiveStatus('[TEST12] Network offline, transfer paused...');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  };
  const stopAggressiveKeepAlive = () => {
    if (window.mobileHeartbeatInterval) {
      clearInterval(window.mobileHeartbeatInterval);
      window.mobileHeartbeatInterval = null;
    }
    releaseWakeLock();
    stopAudioContext();
    console.log('[TEST12] 🔋 Aggressive keep-alive stopped');
  };
  // 2. Enhanced Mobile Transfer Handler
  const enhancedHandleTransfer = (targetDevice) => {
    if (!user) {
      alert('Please sign in to use ShareZidi!');
      return;
    }
    if (!selectedFiles.length) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (isMobile) {
      if (totalSize > 10 * 1024 * 1024) {
        showMobileTransferModal(totalSize, () => {
          proceedWithMobileTransfer(targetDevice);
        }, () => {
          console.log('[TEST12] Mobile transfer cancelled by user');
        });
      } else {
        proceedWithMobileTransfer(targetDevice);
      }
    } else {
      handleTransfer(targetDevice);
    }
  };
  const proceedWithMobileTransfer = (targetDevice) => {
    console.log('[TEST12] 📱 Starting mobile-optimized transfer');
    startAggressiveKeepAlive();
    showMobileTransferStatus();
    detectBackgroundInterference();
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const mobileSettings = getMobileOptimizedSettings(totalSize);
    console.log('[TEST12] 📱 Mobile settings applied:', mobileSettings);
    handleTransferWithMobileSettings(targetDevice, mobileSettings);
  };
  const handleTransferWithMobileSettings = (targetDevice, mobileSettings) => {
    // Use the same logic as handleTransfer, but override chunkSize and parallelCount
    if (!user) {
      alert('Please sign in to use ShareZidi!');
      return;
    }
    if (!selectedFiles.length) return;

    setTransfersInProgress(prev => ({
      ...prev,
      [targetDevice.id]: {
        isTransferring: true,
        currentFile: selectedFiles[0],
        progress: 0,
        status: `[TEST12] 📱 Mobile transfer starting...`,
        error: null,
        fileIndex: 0,
        totalFiles: selectedFiles.length,
        mobileOptimized: true
      }
    }));

    requestWakeLock();
    startAudioContext();

    let fileIndex = 0;
    let waitingForConfirmation = false;

    const sendNextFile = async () => {
      if (fileIndex >= selectedFiles.length) {
        stopAggressiveKeepAlive();
        hideMobileTransferStatus();
        hideMobileProgress();
        setTransfersInProgress(prev => ({
          ...prev,
          [targetDevice.id]: {
            isTransferring: false,
            currentFile: null,
            progress: 100,
            status: `[TEST12] 🎉 All files sent successfully!`,
            error: null
          }
        }));
        return;
      }
      const file = selectedFiles[fileIndex];
      updateMobileProgress(0, file.name, navigator.connection);
      const chunkSize = mobileSettings.chunkSize;
      const parallelCount = mobileSettings.parallelCount;
      const totalChunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      let activeTransfers = 0;
      let isPaused = false;
      let fileTransferCompleted = false;
      const handleVisibilityChange = () => {
        if (document.hidden) {
          isPaused = true;
        } else {
          isPaused = false;
          while (activeTransfers < parallelCount && currentChunk < totalChunks && !fileTransferCompleted) {
            readAndSendChunk();
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      const readAndSendChunk = () => {
        if (isPaused || fileTransferCompleted) return;
        const chunkIndex = currentChunk++;
        activeTransfers++;
        if (chunkIndex >= totalChunks) {
          activeTransfers--;
          if (activeTransfers === 0 && !fileTransferCompleted) {
            fileTransferCompleted = true;
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: true,
                currentFile: file,
                progress: 100,
                status: `[TEST12] ✅ File ${fileIndex + 1}/${selectedFiles.length} sent: ${file.name}`,
                error: null,
                fileIndex: fileIndex,
                totalFiles: selectedFiles.length
              }
            }));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            fileIndex++;
            setTimeout(() => {
              sendNextFile();
            }, 2000);
          }
          return;
        }
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const emitPayload = {
              toUserId: targetDevice.id,
              chunk: e.target.result,
              progress: ((chunkIndex + 1) / totalChunks) * 100,
              chunkIndex: chunkIndex,
              totalChunks: totalChunks
            };
            socket.emit('file-chunk', emitPayload);
            updateMobileProgress(((chunkIndex + 1) / totalChunks) * 100, file.name, navigator.connection);
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: true,
                currentFile: file,
                progress: ((chunkIndex + 1) / totalChunks) * 100,
                status: `[TEST12] 📱 Sending ${file.name}... ${(((chunkIndex + 1) / totalChunks) * 100).toFixed(1)}%`,
                error: null,
                fileIndex: fileIndex,
                totalFiles: selectedFiles.length
              }
            }));
            activeTransfers--;
            if (chunkIndex + 1 === totalChunks && activeTransfers === 0 && !fileTransferCompleted) {
              fileTransferCompleted = true;
              setTransfersInProgress(prev => ({
                ...prev,
                [targetDevice.id]: {
                  isTransferring: true,
                  currentFile: file,
                  progress: 100,
                  status: `[TEST12] ✅ File ${fileIndex + 1}/${selectedFiles.length} sent: ${file.name}`,
                  error: null,
                  fileIndex: fileIndex,
                  totalFiles: selectedFiles.length
                }
              }));
              document.removeEventListener('visibilitychange', handleVisibilityChange);
              fileIndex++;
              setTimeout(() => {
                sendNextFile();
              }, 2000);
              return;
            }
            if (activeTransfers < parallelCount && currentChunk < totalChunks && !fileTransferCompleted) {
              if ('requestIdleCallback' in window) {
                requestIdleCallback(() => readAndSendChunk(), { timeout: 50 });
              } else {
                setTimeout(readAndSendChunk, 10);
              }
            }
          } catch (err) {
            setTransfersInProgress(prev => ({
              ...prev,
              [targetDevice.id]: {
                isTransferring: false,
                currentFile: null,
                progress: 0,
                status: '',
                error: 'Error sending file: ' + err.message
              }
            }));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          }
        };
        reader.onerror = (err) => {
          setTransfersInProgress(prev => ({
            ...prev,
            [targetDevice.id]: {
              isTransferring: false,
              currentFile: null,
              progress: 0,
              status: '',
              error: 'FileReader error: ' + err.message
            }
          }));
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        reader.readAsArrayBuffer(chunk);
      };
      socket.emit('transfer-request', {
        toUserId: targetDevice.id,
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          totalChunks: totalChunks,
          chunkSize: chunkSize,
          fileIndex: fileIndex,
          totalFiles: selectedFiles.length
        }
      });
      setTimeout(() => {
        for (let i = 0; i < parallelCount && currentChunk < totalChunks; i++) {
          readAndSendChunk();
        }
      }, 200);
    };
    sendNextFile();
  };
  // 3. Chunk Acknowledgment and Retry
  // 4. Mobile Transfer Modal and Status
  const showMobileTransferModal = (fileSize, onProceed, onCancel) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      onProceed();
      return;
    }
    if (document.getElementById('mobileTransferModal')) return;
    const modal = document.createElement('div');
    modal.id = 'mobileTransferModal';
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9998;"></div>
      <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:16px;box-shadow:0 8px 32px #0002;z-index:9999;min-width:320px;max-width:90vw;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">📱</div>
        <h3 style="color:#ff6b35;margin:0 0 16px 0;">Mobile Transfer Tips</h3>
        <div style="text-align:left;margin:16px 0;padding:16px;background:#f8f9fa;border-radius:8px;">
          <p style="margin:8px 0;"><strong>🚀 For best results:</strong></p>
          <p style="margin:4px 0;">• Keep this tab active and visible</p>
          <p style="margin:4px 0;">• Avoid switching to other apps</p>
          <p style="margin:4px 0;">• Pause YouTube/videos if running</p>
          <p style="margin:4px 0;">• Stay on WiFi if possible</p>
          <p style="margin:4px 0;">• Don't lock your phone during transfer</p>
        </div>
        <div style="color:#666;font-size:0.9em;margin:12px 0;">
          File size: ${(fileSize/1024/1024).toFixed(1)}MB<br>
          Transfer will auto-resume if interrupted
        </div>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
          <button id="cancelMobileTransfer" style="background:#666;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-weight:600;cursor:pointer;">
            Cancel
          </button>
          <button id="proceedMobileTransfer" style="background:#ff6b35;color:#fff;border:none;border-radius:8px;padding:12px 24px;font-weight:600;cursor:pointer;">
            Start Transfer
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('cancelMobileTransfer').onclick = () => {
      document.body.removeChild(modal);
      onCancel();
    };
    document.getElementById('proceedMobileTransfer').onclick = () => {
      document.body.removeChild(modal);
      onProceed();
    };
  };
  const showMobileTransferStatus = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return null;
    if (document.getElementById('mobileStatusIndicator')) return;
    const indicator = document.createElement('div');
    indicator.id = 'mobileStatusIndicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b35;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(255,107,53,0.3);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <div id="statusIcon">📱</div>
        <div id="statusText">Mobile Transfer Active</div>
      </div>
    `;
    document.body.appendChild(indicator);
    let iconIndex = 0;
    const icons = ['📱', '📲', '📳'];
    setInterval(() => {
      const iconEl = document.getElementById('statusIcon');
      if (iconEl) {
        iconEl.textContent = icons[iconIndex];
        iconIndex = (iconIndex + 1) % icons.length;
      }
    }, 1000);
    return indicator;
  };
  const hideMobileTransferStatus = () => {
    const indicator = document.getElementById('mobileStatusIndicator');
    if (indicator) {
      document.body.removeChild(indicator);
    }
  };
  const updateMobileProgress = (progress, fileName, networkInfo) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;
    let progressModal = document.getElementById('mobileProgressModal');
    if (!progressModal) {
      progressModal = document.createElement('div');
      progressModal.id = 'mobileProgressModal';
      document.body.appendChild(progressModal);
    }
    progressModal.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 20px;
        z-index: 1001;
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="font-size:24px;">📤</div>
          <div style="flex:1;">
            <div style="font-weight:600;color:#333;">${fileName}</div>
            <div style="font-size:0.9em;color:#666;">${progress.toFixed(1)}% complete</div>
          </div>
          <div style="color:#ff6b35;font-weight:600;">${progress.toFixed(0)}%</div>
        </div>
        <div style="width:100%;height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden;">
          <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#ff6b35,#ff8a5c);transition:width 0.3s ease;"></div>
        </div>
        ${networkInfo ? `
          <div style="font-size:0.8em;color:#666;margin-top:8px;text-align:center;">
            ${networkInfo.effectiveType?.toUpperCase()} • ${networkInfo.downlink}Mbps
          </div>
        ` : ''}
        <div style="font-size:0.8em;color:#999;margin-top:8px;text-align:center;">
          Keep this tab active for best performance
        </div>
      </div>
    `;
  };
  const hideMobileProgress = () => {
    const progressModal = document.getElementById('mobileProgressModal');
    if (progressModal) {
      document.body.removeChild(progressModal);
    }
  };
  const detectBackgroundInterference = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;
    let performanceBaseline = performance.now();
    let lagDetected = false;
    const checkPerformance = () => {
      const now = performance.now();
      const expectedInterval = 1000;
      const actualInterval = now - performanceBaseline;
      const lag = actualInterval - expectedInterval;
      if (lag > 500 && !lagDetected) {
        lagDetected = true;
        console.log(`[TEST12] 🐌 Performance lag detected: ${lag.toFixed(0)}ms`);
        if (receivingFileRef.current || Object.values(transfersInProgress).some(t => t.isTransferring)) {
          showInterferenceWarning();
        }
        setTimeout(() => {
          lagDetected = false;
        }, 10000);
      }
      performanceBaseline = now;
    };
    setInterval(checkPerformance, 1000);
  };
  const showInterferenceWarning = () => {
    if (document.getElementById('interferenceWarning')) return;
    const warning = document.createElement('div');
    warning.id = 'interferenceWarning';
    warning.innerHTML = `
      <div style="
        position: fixed;
        top: 60px;
        left: 20px;
        right: 20px;
        background: #fff3cd;
        color: #856404;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #ffeaa7;
        z-index: 1002;
        font-size: 14px;
      ">
        <strong>⚠️ Performance Impact Detected</strong><br>
        Other apps may be slowing down your transfer. Consider closing YouTube, games, or other resource-intensive apps.
        <button onclick="this.parentElement.remove()" style="float:right;background:none;border:none;font-size:18px;cursor:pointer;color:#856404;">×</button>
      </div>
    `;
    document.body.appendChild(warning);
    setTimeout(() => {
      if (document.getElementById('interferenceWarning')) {
        document.body.removeChild(warning);
      }
    }, 10000);
  };
  // 5. Mobile-Optimized Settings
  const getMobileOptimizedSettings = (fileSize) => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      return {
        chunkSize: getOptimalChunkSize(fileSize),
        parallelCount: getParallelChunkCount(),
        retryAttempts: 3,
        retryDelay: 1000
      };
    }
    const networkType = connection?.effectiveType || 'unknown';
    let chunkSize, parallelCount, retryAttempts, retryDelay;
    switch (networkType) {
      case '4g':
      case 'fast-3g':
        chunkSize = Math.min(128 * 1024, fileSize);
        parallelCount = 1;
        retryAttempts = 5;
        retryDelay = 500;
        break;
      case '3g':
        chunkSize = Math.min(64 * 1024, fileSize);
        parallelCount = 1;
        retryAttempts = 7;
        retryDelay = 1000;
        break;
      case '2g':
      case 'slow-2g':
        chunkSize = Math.min(32 * 1024, fileSize);
        parallelCount = 1;
        retryAttempts = 10;
        retryDelay = 2000;
        break;
      default:
        chunkSize = Math.min(64 * 1024, fileSize);
        parallelCount = 1;
        retryAttempts = 5;
        retryDelay = 1000;
    }
    console.log('[TEST12] 📱 Mobile settings:', {
      networkType,
      chunkSize: `${(chunkSize/1024).toFixed(0)}KB`,
      parallelCount,
      retryAttempts,
      retryDelay: `${retryDelay}ms`
    });
    return { chunkSize, parallelCount, retryAttempts, retryDelay };
  };
  // --- END MOBILE ROBUSTNESS ENHANCEMENTS ---

  // --- MISSING CHUNK RECOVERY PROTOCOL (TEST14) ---

  // Add retry/backoff state
  const missingChunkRequestAttemptsRef = useRef(0);
  const MAX_MISSING_CHUNK_ATTEMPTS = 5;

  // On the receiver: request missing chunks after stall, disconnect, or at the end
  const requestMissingChunks = () => {
    if (!receivingFileRef.current || !receivedChunksRef.current) return;
    const missingChunks = [];
    for (let i = 0; i < receivedChunksRef.current.length; i++) {
      if (!receivedChunksRef.current[i]) missingChunks.push(i);
    }
    if (missingChunks.length > 0) {
      missingChunkRequestAttemptsRef.current++;
      if (missingChunkRequestAttemptsRef.current > MAX_MISSING_CHUNK_ATTEMPTS) {
        setError(`[TEST14] Too many failed attempts to recover missing chunks. Sender may be offline or unavailable. Aborting transfer.`);
        setReceiveStatus(`[TEST14] Transfer failed: sender unavailable or not responding.`);
        releaseWakeLock();
        stopAudioContext();
        stopTransferMonitoring();
        setReceivingFile(null);
        setReceivedChunks([]);
        receivingFileRef.current = null;
        receivedChunksRef.current = null;
        receivedChunkCountRef.current = 0;
        setTransferProgress(0);
        return;
      }
      console.warn(`[TEST14] Requesting ${missingChunks.length} missing chunks from sender... (attempt ${missingChunkRequestAttemptsRef.current}/${MAX_MISSING_CHUNK_ATTEMPTS})`);
      socket.emit('request-missing-chunks', {
        toUserId: receivingFileRef.current.from,
        fileName: receivingFileRef.current.name,
        missingChunks
      });
    }
  };

  // Reset retry counter on new transfer or successful chunk receipt
  useEffect(() => {
    if (!receivingFile) {
      missingChunkRequestAttemptsRef.current = 0;
    }
  }, [receivingFile]);

  // In file-chunk handler, reset attempts on new chunk
  // ... inside socket.on('file-chunk', ...)
  // After storing a new chunk:
  missingChunkRequestAttemptsRef.current = 0;

  // Call requestMissingChunks after transfer stalls, disconnects, or at the end
  const checkTransferHealth = () => {
    if (receivingFileRef.current) {
      const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;
      if (timeSinceLastChunk > 15000) {
        console.log(`[TEST12] ⚠️ Transfer stalled for ${timeSinceLastChunk}ms`);
        requestMissingChunks();
        if (socket.connected) {
          setReceiveStatus(`[TEST12] Transfer stalled, requesting resume...`);
          requestResumeWithCooldown();
        } else {
          setReceiveStatus(`[TEST12] Connection lost, waiting for reconnection...`);
        }
      }
      transferTimeoutRef.current = setTimeout(checkTransferHealth, 5000);
    }
  };

  // On the sender: listen for 'request-missing-chunks' and resend only those chunks
  socket.on('request-missing-chunks', async ({ from, fileName, missingChunks }) => {
    // Find the file in selectedFiles or keep a reference during transfer
    // For MVP, assume only one file transfer at a time
    const file = selectedFiles && selectedFiles.length ? selectedFiles[0] : null;
    if (!file || file.name !== fileName) {
      console.error('[TEST12] Cannot resend missing chunks: file not found or name mismatch');
      return;
    }
    const chunkSize = getOptimalChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / chunkSize);
    for (const chunkIndex of missingChunks) {
      if (chunkIndex < 0 || chunkIndex >= totalChunks) continue;
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const reader = new FileReader();
      reader.onload = (e) => {
        socket.emit('file-chunk', {
          toUserId: from,
          chunk: e.target.result,
          progress: ((chunkIndex + 1) / totalChunks) * 100,
          chunkIndex,
          totalChunks
        });
        console.log(`[TEST12] 🔁 Resent missing chunk ${chunkIndex + 1}/${totalChunks}`);
      };
      reader.readAsArrayBuffer(chunk);
      // Throttle resends to avoid flooding
      await new Promise(res => setTimeout(res, 5));
    }
  });

  // Only clear sender's file from memory after transfer-confirmed
  socket.on('transfer-confirmed', ({ toUserId, fileName }) => { 
    // If sender, clear file reference only after confirmation
    if (selectedFiles && selectedFiles.length && selectedFiles[0].name === fileName) {
      // Optionally clear selectedFiles or mark as sent
      // selectedFiles = [];
      console.log(`[TEST12] Sender received transfer-confirmed for ${fileName}, safe to clear file from memory.`);
    }
  });

  if (!user) {
    return (
      <div className="App" style={{ textAlign: 'center', marginTop: 80 }}>
        <img src="https://www.netzidi.com/share/imgs/logos/sharezidi-logo-clr.gif" alt="ShareZidi" style={{ width:120, marginBottom:8 }}/>
        <h2>Welcome to ShareZidi</h2>
        <p>Please sign in to continue</p>
        <GoogleLoginButton onSuccess={setUser} onError={err => console.error('[AUTH] Login error:', err)} />
      </div>
    );
  }

  return (
    <AppLayout
      user={user}
      userId={userId}
      mySocketId={mySocketId}
      devices={devices}
      selectedFiles={selectedFiles}
      transfersInProgress={transfersInProgress}
      receivingFile={receivingFile}
      receivedChunks={receivedChunks}
      receiveStatus={receiveStatus}
      error={error}
      disconnected={disconnected}
      disconnectReason={disconnectReason}
      isDragging={isDragging}
      transferSpeed={transferSpeed}
      fileInputRef={fileInputRef}
      handleFileSelect={handleFileSelect}
      handleTransfer={enhancedHandleTransfer}
      handleDragOver={handleDragOver}
      handleDragLeave={handleDragLeave}
      handleDrop={handleDrop}
      openFileDialog={openFileDialog}
      removeFile={removeFile}
      getFileThumbnail={getFileThumbnail}
      formatFileName={formatFileName}
      totalSizeMB={totalSizeMB}
      getDeviceIcon={getDeviceIcon}
      showDiagnostics={showDiagnostics}
      echoTarget={echoTarget}
      setEchoTarget={setEchoTarget}
      echoMessage={echoMessage}
      setEchoMessage={setEchoMessage}
      broadcastMessage={broadcastMessage}
      setBroadcastMessage={setBroadcastMessage}
      directPingTarget={directPingTarget}
      setDirectPingTarget={setDirectPingTarget}
      logDiag={logDiag}
      fetchAllIds={fetchAllIds}
      allIds={allIds}
      diagnosticLog={diagnosticLog}
      GoogleLoginButton={GoogleLoginButton}
      socket={socket}
      getOptimalChunkSize={getOptimalChunkSize}
      getParallelChunkCount={getParallelChunkCount}
      transferMetricsRef={transferMetricsRef}
      handleZipAndSend={handleZipAndSend}
    />
  );
}

export default App;