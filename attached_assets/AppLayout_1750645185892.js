import React from 'react';

const AppLayout = ({
  user,
  userId,
  mySocketId,
  devices,
  selectedFiles,
  transfersInProgress,
  receivingFile,
  receivedChunks,
  receiveStatus,
  error,
  disconnected,
  disconnectReason,
  isDragging,
  transferSpeed,
  fileInputRef,
  handleFileSelect,
  handleTransfer,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  openFileDialog,
  removeFile,
  getFileThumbnail,
  formatFileName,
  totalSizeMB,
  getDeviceIcon,
  showDiagnostics,
  echoTarget,
  setEchoTarget,
  echoMessage,
  setEchoMessage,
  broadcastMessage,
  setBroadcastMessage,
  directPingTarget,
  setDirectPingTarget,
  logDiag,
  fetchAllIds,
  allIds,
  diagnosticLog,
  GoogleLoginButton,
  socket,
  getOptimalChunkSize,
  getParallelChunkCount,
  transferMetricsRef,
  handleZipAndSend,
  multiFileTransfer
}) => {
  if (!user) {
    return (
      <div className="App" style={{ textAlign: 'center', marginTop: 80 }}>
        <img src="https://www.netzidi.com/share/imgs/logos/sharezidi-logo-clr.gif" alt="ShareZidi" style={{ width:120, marginBottom:8 }}/>
        <h2>Welcome to ShareZidi</h2>
        <p>Please sign in to continue</p>
        <GoogleLoginButton onSuccess={() => {}} onError={err => console.error('[AUTH] Login error:', err)} />
      </div>
    );
  }

  const activeTransfers = Object.entries(transfersInProgress).filter(([_, t]) => t.isTransferring);
  const hasActiveTransfers = activeTransfers.length > 0;

  const renderTransferSummary = () => {
    if (!hasActiveTransfers) return null;
    return (
      <div style={{ maxWidth: 400, margin: '24px auto 0 auto', textAlign: 'center', background: '#f8fafc', padding: 16, borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
        <h3 style={{ margin: 0, color: '#4a148c' }}>Active Transfers</h3>
        {activeTransfers.map(([deviceId, transfer]) => (
          <div key={deviceId} style={{ marginTop: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>Sending to Device {deviceId}: {formatFileName(transfer.currentFile.name)}</div>
            <div style={{ width: '100%', height: 7, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: `${transfer.progress}%`, height: '100%', background: 'linear-gradient(90deg, #42b6ff 0%, #8ab4f8 100%)', borderRadius: 4, transition: 'width 0.2s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>{transfer.progress.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{transfer.status}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="App">
      {/* Logo and ID section */}
      <div style={{ textAlign:'center', margin:'24px 0 8px' }}>
        <img src="https://www.netzidi.com/share/imgs/logos/sharezidi-logo-clr.gif" alt="ShareZidi" style={{ width:120, marginBottom:8 }}/>
        <div style={{ color:'#888', fontSize:18 }}>Your ID: <span style={{ color:'#d14fa2', fontWeight:600 }}>{userId}</span></div>
        {/* Show connection info */}
        {navigator.connection && (
          <div style={{ color:'#666', fontSize:14, marginTop:4 }}>
            Connection: {navigator.connection.effectiveType?.toUpperCase() || 'Unknown'} 
            {navigator.connection.downlink && ` (${navigator.connection.downlink} Mbps)`}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div style={{ textAlign:'center', margin:'16px 0 8px' }}>
        <button onClick={() => window.location.reload()}
          style={{ background:'#42b6ff', color:'#fff', border:'none', borderRadius:8, padding:'8px 24px', fontWeight:600, fontSize:16, cursor:'pointer', boxShadow:'0 1px 4px #42b6ff22', transition:'background 0.2s', display:'inline-flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20, display:'inline-block', transform:'rotate(-20deg)' }}>🔄</span>Refresh
        </button>
      </div>

      <main>
        {/* hidden file-picker used by every "Send File" button */}
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* =====  FILE SELECTION  ===== */}
        <section className="file-selection">
          <h2>Select Files to Transfer</h2>

          <div
            className={`dropzone${isDragging ? ' dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={e => {
              if (e.target === e.currentTarget) openFileDialog();
            }}
            style={{
              background: isDragging ? '#eaf6fb' : '#f8fafc',
              border: '2.5px dashed #8ab4f8',
              borderRadius: 20,
              boxShadow: isDragging ? '0 4px 24px #8ab4f822' : '0 2px 8px #0001',
              transition: 'all 0.2s',
              cursor: 'pointer',
              padding: 40,
              margin: '0 auto 16px',
              maxWidth: 400,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 8 }}>🚀</div>

            <p style={{ margin: 0 }}>
              <span style={{ fontWeight: 600 }}>Drag &amp; Drop</span> files here
              <br />
              or{' '}
              <span
                style={{ color: '#42b6ff', textDecoration: 'underline', cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  openFileDialog();
                }}
              >
                Browse
              </span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>

          {/* selected file list with optimization preview */}
          {selectedFiles.length > 0 && (
            <div style={{ textAlign: 'left', margin: '0 auto', maxWidth: 400 }}>
              <ul style={{ padding: 0, margin: 0 }}>
                {selectedFiles.map((file, idx) => {
                  const optimalChunkSize = getOptimalChunkSize(file.size);
                  const parallelCount = getParallelChunkCount();
                  return (
                    <li
                      key={file.name + idx}
                      style={{ display: 'flex', alignItems: 'center', marginBottom: 8, listStyle: 'none' }}
                    >
                      <img
                        src={getFileThumbnail(file)}
                        alt={file.name}
                        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, marginRight: 8, border: '1px solid #ccc' }}
                        onLoad={e => file.type.startsWith('image/') && URL.revokeObjectURL(e.target.src)}
                      />
                      <div style={{ flex: 1 }}>
                        <div>{formatFileName(file.name)} ({(file.size / 1024 / 1024).toFixed(2)} MB)</div>
                        <div style={{ fontSize: 11, color: '#666' }}>
                          Optimized: {parallelCount} streams, {(optimalChunkSize/1024).toFixed(0)}KB chunks
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        style={{ marginLeft: 8, color: 'red', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 18 }}
                        title="Remove file"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div style={{ marginTop: 8, fontWeight: 'bold' }}>Total: {totalSizeMB} MB</div>
            </div>
          )}
        </section>

        {/* =====  DEVICE LIST  ===== */}
        <section className="devices">
          <h2>Available Devices</h2>
          <ul style={{ padding: 0, margin: 0 }}>
            {devices
              .filter(device => device.id !== mySocketId)
              .map(device => {
                const transfer = transfersInProgress[device.id] || { isTransferring: false, currentFile: null, progress: 0, status: '', error: null };
                return (
                  <li
                    key={device.id}
                    style={{ display: 'flex', alignItems: 'center', marginBottom: 12, listStyle: 'none', padding: '12px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}
                  >
                    <img
                      src={getDeviceIcon(device.type)}
                      alt={device.type}
                      style={{ width: 32, height: 32, marginRight: 10 }}
                    />
                    <span style={{ fontWeight: 600, color: '#222', fontSize: 18, marginRight: 12 }}>
                      ID:&nbsp;<span style={{ color: '#009688' }}>{device.name.replace('Device ', '')}</span>
                    </span>

                    {selectedFiles.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <button
                          onClick={() => handleTransfer(device)}
                          disabled={transfersInProgress[device.id]?.isTransferring}
                          style={{
                            background: transfer.isTransferring ? '#ccc' : '#42b6ff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 16px',
                            fontWeight: 600,
                            cursor: transfer.isTransferring ? 'not-allowed' : 'pointer',
                            fontSize: 15,
                            boxShadow: '0 1px 4px #42b6ff22',
                            transition: 'background 0.2s',
                            opacity: transfer.isTransferring ? 0.7 : 1
                          }}
                        >
                          {transfer.isTransferring ? 'Sending...' : `Send File${selectedFiles.length > 1 ? 's' : ''}`}
                        </button>
                        {handleZipAndSend && (
                          <button
                            onClick={() => handleZipAndSend(device)}
                            disabled={transfersInProgress[device.id]?.isTransferring}
                            style={{
                              background: transfer.isTransferring ? '#ccc' : '#4a148c',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '8px 16px',
                              fontWeight: 600,
                              cursor: transfer.isTransferring ? 'not-allowed' : 'pointer',
                              fontSize: 15,
                              boxShadow: '0 1px 4px #4a148c22',
                              transition: 'background 0.2s',
                              opacity: transfer.isTransferring ? 0.7 : 1
                            }}
                          >
                            {transfer.isTransferring ? 'Sending...' : 'ZIP and Send'}
                          </button>
                        )}
                      </div>
                    )}
                    {/* Ping button for test */}
                    {showDiagnostics && (
                      <button
                        onClick={() => {
                          socket.emit('ping', { toUserId: device.id });
                          console.log('[PING] sent to', device.id);
                        }}
                        style={{
                          marginLeft: 8,
                          background: '#ffd600',
                          color: '#333',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 15,
                          boxShadow: '0 1px 4px #ffd60022',
                          transition: 'background 0.2s',
                        }}
                      >
                        Ping
                      </button>
                    )}
                    {transfer.isTransferring && (
                      <div style={{ marginLeft: 8, flex: 1, maxWidth: 200 }}>
                        <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                          Sending: {transfer.currentFile ? formatFileName(transfer.currentFile.name) : 'Processing...'}
                        </div>
                        {transfer.totalFiles > 1 && (
                          <div style={{ fontSize: 12, color: '#666', fontWeight: 400 }}>
                            File {(transfer.fileIndex || 0) + 1} of {transfer.totalFiles}
                          </div>
                        )}
                        <div style={{ width: '100%', height: 7, background: '#e0e0e0', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                          <div style={{ width: `${transfer.progress}%`, height: '100%', background: 'linear-gradient(90deg, #42b6ff 0%, #8ab4f8 100%)', borderRadius: 4, transition: 'width 0.2s ease' }} />
                        </div>
                        <div style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>{transfer.progress.toFixed(1)}%</div>
                        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{transfer.status}</div>
                        {transfer.error && (
                          <div style={{ fontSize: 11, color: '#f44336', marginTop: 2 }}>Error: {transfer.error}</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>

        {renderTransferSummary()}

        {/* Receiving file status */}
        {receivingFile && (
          <div style={{ maxWidth: 400, margin: '16px auto', padding: 16, background: '#e8f5e8', borderRadius: 8, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>
              Receiving File
              {/* Show multi-file progress if available through props */}
              {multiFileTransfer && multiFileTransfer.totalFiles > 1 && ` (${multiFileTransfer.currentFile} of ${multiFileTransfer.totalFiles})`}
            </h3>
            <div style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
              {receivingFile.name} ({(receivingFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>From device: {receivingFile.from}</div>
          </div>
        )}

        {receiveStatus && (
          <div style={{ 
            color: receiveStatus.includes('Error') ? '#f44336' : '#4caf50', 
            marginTop: 8, 
            textAlign: 'center',
            fontWeight: 500 
          }}>
            {multiFileTransfer && multiFileTransfer.totalFiles > 1
              ? `${receiveStatus} (File ${multiFileTransfer.currentFile} of ${multiFileTransfer.totalFiles})`
              : receiveStatus}
          </div>
        )}
        {error && <div style={{ color: 'red', marginTop: 8 }}>Error: {error}</div>}
        {disconnected && (
          <div style={{ color: 'orange', marginTop: 8 }}>
            Disconnected from server. Reason: {disconnectReason}
          </div>
        )}
      </main>

      {/* Diagnostic Panel */}
      {showDiagnostics && (
        <div style={{border:'2px solid #ffd600', borderRadius:12, margin:'32px auto', maxWidth:600, padding:16, background:'#fffbe6'}}>
          <h3>Diagnostic Panel</h3>
          <div>User ID: <b>{userId}</b> | Socket ID: <b>{socket?.id}</b></div>
          <div style={{margin:'8px 0'}}>
            <input value={echoTarget} onChange={e=>setEchoTarget(e.target.value)} placeholder="Echo target userId" style={{width:120,marginRight:4}}/>
            <input value={echoMessage} onChange={e=>setEchoMessage(e.target.value)} placeholder="Echo message" style={{width:120,marginRight:4}}/>
            <button onClick={()=>{socket?.emit('echo',{toUserId:echoTarget,message:echoMessage});logDiag('Sent echo to',echoTarget,':',echoMessage);}}>Echo Test</button>
            <input value={broadcastMessage} onChange={e=>setBroadcastMessage(e.target.value)} placeholder="Broadcast msg" style={{width:120,marginLeft:8,marginRight:4}}/>
            <button onClick={()=>{socket?.emit('broadcast',{message:broadcastMessage});logDiag('Sent broadcast:',broadcastMessage);}}>Broadcast</button>
            <button onClick={()=>{socket?.emit('get-time');logDiag('Requested server time');}} style={{marginLeft:8}}>Get Server Time</button>
          </div>
          <div style={{margin:'8px 0'}}>
            <input value={directPingTarget} onChange={e=>setDirectPingTarget(e.target.value)} placeholder="Target socket.id" style={{width:180,marginRight:4}}/>
            <button onClick={()=>{socket?.emit('direct-ping',{toSocketId:directPingTarget,message:'Direct ping!'});logDiag('Sent direct-ping to',directPingTarget);}}>Direct Ping</button>
            <button onClick={fetchAllIds} style={{marginLeft:8}}>Show All IDs</button>
          </div>
          <div style={{margin:'8px 0',fontSize:13}}>
            <b>All IDs:</b> <pre style={{display:'inline',fontSize:13}}>{JSON.stringify(allIds,null,2)}</pre>
          </div>
          <div style={{maxHeight:180,overflowY:'auto',background:'#ffffef7',border:'1px solid #ffd600',borderRadius:8,padding:8,fontSize:13,marginTop:8}}>
            <b>Log:</b>
            <pre style={{margin:0}}>{diagnosticLog.join('\n')}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;