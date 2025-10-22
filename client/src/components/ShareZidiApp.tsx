import React, { useState, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useFileTransferV2 } from "../hooks/useFileTransferV2";
import { useAuth } from "../hooks/useAuth";
import { useAccessibility } from "../hooks/useAccessibility";
import { useAriaAnnouncements } from "../hooks/useAriaAnnouncements";
import { TransferSyncMonitor } from "./TransferSyncMonitor";
import { FileSelector } from "./FileSelector";
import { DeviceList } from "./DeviceList";
import { ErrorRecoveryPanel } from "./ErrorRecoveryPanel";
import { ConnectionHelper } from "./ConnectionHelper";
import { MobileTransferGuard } from "./MobileTransferGuard";
import { ZipProgress } from "./ZipProgress";
import { AuthModal } from "./AuthModal";
import { UsageBanner } from "./UsageBanner";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { QrCode, RotateCcw, LogOut, Settings } from "lucide-react";
import type { Device } from "@shared/types";

export const ShareZidiApp: React.FC = () => {
  const websocket = useWebSocket();
  // V2 Configuration with all revolutionary features
  const transferConfig = {
    webrtc: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      chunkSize: 1024 * 1024, // 1MB chunks
      maxRetries: 3
    },
    pwa: {
      appName: 'ShareZidi v2.0',
      appShortName: 'ShareZidi',
      appDescription: 'Revolutionary file transfer with WebRTC, encryption, and resume capability',
      themeColor: '#3B82F6',
      backgroundColor: '#FFFFFF',
      display: 'standalone' as const,
      orientation: 'any' as const,
      startUrl: '/',
      scope: '/'
    },
    sw: {
      cacheName: 'sharezidi-v2.0',
      cacheVersion: '2.0.0',
      offlinePage: '/offline.html',
      staticAssets: ['/', '/index.html', '/manifest.json'],
      dynamicRoutes: ['/api/', '/transfer/', '/files/']
    }
  };

  const fileTransfer = useFileTransferV2(websocket, transferConfig);
  const auth = useAuth();
  const accessibility = useAccessibility();
  const announcements = useAriaAnnouncements();
  const [showConnectionHelper, setShowConnectionHelper] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>('');

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      // Alt + A to open accessibility panel
      if (event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setShowAccessibilityPanel(true);
      }

      // Escape to close modals
      if (event.key === "Escape") {
        setShowAccessibilityPanel(false);
        setShowConnectionHelper(false);
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  const connectionInfo = {
    effectiveType: (navigator as any).connection?.effectiveType,
    downlink: (navigator as any).connection?.downlink,
    status: websocket.isConnected
      ? "connected"
      : websocket.reconnectAttempts > 0
        ? "reconnecting"
        : "disconnected",
  };

  const handleSendFiles = async (device: Device) => {
    // Check if user can transfer
    if (!auth.canTransfer()) {
      alert(
        "Transfer limit reached. Please upgrade to Pro for unlimited transfers.",
      );
      return;
    }

    try {
      await fileTransfer.startTransfer(device, fileTransfer.selectedFiles);
      auth.incrementTransferCount();
      announcements.announceTransferStart(
        device.name || device.id,
        fileTransfer.selectedFiles.length,
      );
    } catch (error) {
      console.error("Failed to start transfer:", error);
      announcements.announceTransferError("Failed to start transfer");
    }
  };

  // V2 Features
  const handleGenerateQR = async () => {
    try {
      const qrCode = await fileTransfer.generateDeviceQR();
      setQrCodeData(qrCode);
      setShowQRCode(true);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  };

  const handleGenerateTransferQR = async () => {
    if (fileTransfer.selectedFiles.length === 0) {
      announcements.announceTransferError("No files selected for QR transfer");
      return;
    }

    try {
      const qrCode = await fileTransfer.generateTransferQR(fileTransfer.selectedFiles[0]);
      setQrCodeData(qrCode);
      setShowQRCode(true);
    } catch (error) {
      console.error("Failed to generate transfer QR code:", error);
    }
  };

  const handleZipAndSend = async (device: Device) => {
    // Check if user can transfer
    if (!auth.canTransfer()) {
      alert(
        "Transfer limit reached. Please upgrade to Pro for unlimited transfers.",
      );
      return;
    }

    if (fileTransfer.selectedFiles.length === 0) {
      console.warn("[FileTransfer] No files selected for zipping");
      return;
    }

    console.log(
      "[FileTransfer] Creating ZIP archive for",
      fileTransfer.selectedFiles.length,
      "files",
    );

    try {
      // Dynamic import of JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add all selected files to the ZIP
      for (const file of fileTransfer.selectedFiles) {
        console.log("[FileTransfer] Adding to ZIP:", file.name);
        zip.file(file.name, file);
      }

      // Generate the ZIP file
      console.log("[FileTransfer] Generating ZIP archive...");
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Calculate total original size
      const originalSize = fileTransfer.selectedFiles.reduce(
        (sum, file) => sum + file.size,
        0,
      );
      const compressionRatio = (
        ((originalSize - zipBlob.size) / originalSize) *
        100
      ).toFixed(1);

      console.log(
        `[FileTransfer] ZIP created: ${zipBlob.size} bytes (${compressionRatio}% compression)`,
      );

      // Create a new file object for the ZIP
      const zipFileName = `ShareZidi_${fileTransfer.selectedFiles.length}files_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.zip`;
      const zipFile = new File([zipBlob], zipFileName, {
        type: "application/zip",
      });

      // Create selected file with optimization
      const { TransferUtils } = await import("../lib/transferUtils");
      const selectedZipFile = Object.assign(zipFile, {
        id: TransferUtils.generateFileId(),
        optimizedChunkSize: TransferUtils.getOptimalChunkSize(zipFile.size),
        parallelStreams: TransferUtils.getParallelChunkCount(),
      });

      console.log("[FileTransfer] Starting ZIP transfer to device:", device.id);

      // Start transfer with the ZIP file
      await fileTransfer.startTransfer(device, [selectedZipFile]);
      auth.incrementTransferCount();
      announcements.announceTransferStart(device.name || device.id, 1);
    } catch (error) {
      console.error("[FileTransfer] ZIP creation failed:", error);
      announcements.announceTransferError("ZIP creation failed");
    }
  };

  const handleRetryTransfer = (transferId: string) => {
    console.log("Retry transfer:", transferId);
    // TODO: Implement retry logic
  };

  const handleReduceChunkSize = (transferId: string) => {
    console.log("Reduce chunk size:", transferId);
    // TODO: Implement chunk size reduction
  };

  const handleResumeMissingChunks = (transferId: string) => {
    console.log("Resume missing chunks:", transferId);
    // TODO: Implement missing chunk resume
  };

  const handleCancelTransfer = (transferId: string) => {
    console.log("Cancel transfer:", transferId);
    // TODO: Implement transfer cancellation
  };

  const handleUpgrade = () => {
    // Simple pro upgrade - in production this would integrate with Stripe
    if (auth.user) {
      auth.updateUser({ isPro: true });
      alert("Upgraded to Pro! You now have unlimited transfers.");
    }
  };

  // Show auth modal if user is not authenticated
  if (!auth.isAuthenticated && !auth.isLoading) {
    return (
      <AuthModal isOpen={true} onClose={() => {}} onAuthSuccess={auth.login} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src="/sharezidi-logo.gif"
                alt="ShareZidi Logo"
                className="h-12 w-auto"
              />
            </div>

            {/* Connection Status and Actions */}
            <div className="flex items-center space-x-2 text-sm">
              <div className="hidden sm:flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    websocket.isConnected ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <span className="text-gray-600">
                  {websocket.isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="text-blue-600 font-medium text-xs sm:text-sm">
                ID:{" "}
                <span className="text-gray-600">
                  {websocket.userId || "connecting..."}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleGenerateQR}
                  className="p-2 text-blue-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Generate QR Code for Device Discovery"
                  aria-label="Generate QR code for device discovery"
                >
                  <QrCode className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowAccessibilityPanel(true)}
                  className="p-2 text-purple-600 hover:text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                  title="Accessibility Settings"
                  aria-label="Open accessibility settings panel"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Refresh Page"
                  aria-label="Refresh the page"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Clear server-side session
                      await fetch("/api/auth/logout", { method: "POST" });
                    } catch (error) {
                      console.log(
                        "Logout request failed, clearing client data anyway",
                      );
                    }
                    // Clear any stored user data
                    localStorage.removeItem("user");
                    localStorage.removeItem("transferCount");
                    localStorage.removeItem("lastReset");
                    // Redirect to landing page
                    window.location.href = "/";
                  }}
                  className="p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg border border-red-300 hover:border-red-600 transition-all duration-200"
                  title="Sign Out"
                  aria-label="Sign out of your account"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-6 py-8">
        {/* User Info */}
        {auth.user && (
          <div className="flex justify-end mb-4">
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full border">
              Logged in as{" "}
              <span className="font-medium text-gray-800">
                {(() => {
                  console.log("ShareZidiApp - Current user data:", auth.user);
                  return (
                    auth.user.username ||
                    auth.user.email?.split("@")[0] ||
                    "guest"
                  );
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Usage Banner */}
        <UsageBanner user={auth.user} onUpgrade={handleUpgrade} />

        {/* Mobile Transfer Guard */}
        <MobileTransferGuard
          isTransferring={
            Array.from(fileTransfer.transfers.values()).some(
              (t) => t.isTransferring,
            ) ||
            Array.from(fileTransfer.incomingTransfers?.values() || []).some(
              (t) => t.isTransferring,
            )
          }
        />

        {/* ZIP Progress */}
        <ZipProgress
          isZipping={fileTransfer.isZipping}
          progress={fileTransfer.zipProgress}
        />

        {/* Transfer Sync Monitor */}
        <TransferSyncMonitor
          transfers={fileTransfer.transfers}
          incomingTransfers={fileTransfer.incomingTransfers || new Map()}
          connectionInfo={connectionInfo}
        />

        {/* File Selection */}
        <FileSelector
          selectedFiles={fileTransfer.selectedFiles}
          isDragging={fileTransfer.isDragging}
          fileInputRef={fileTransfer.fileInputRef}
          onFileSelect={(e) => fileTransfer.addFiles(e.target.files!)}
          onDragOver={fileTransfer.handleDragOver}
          onDragLeave={fileTransfer.handleDragLeave}
          onDrop={fileTransfer.handleDrop}
          onOpenFileDialog={fileTransfer.openFileDialog}
          onRemoveFile={fileTransfer.removeFile}
          totalSizeMB={fileTransfer.totalSizeMB.toFixed(2)}
        />

        {/* Device List */}
        <DeviceList
          devices={websocket.devices}
          selectedFiles={fileTransfer.selectedFiles}
          transfers={fileTransfer.transfers}
          onSendFiles={handleSendFiles}
          onZipAndSend={handleZipAndSend}
        />

        {/* Connection Help Banner when no devices */}
        {websocket.devices.length === 0 && websocket.isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <div className="text-blue-600 mb-2">
              <i className="fas fa-mobile-alt text-3xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              Connect Your Mobile Device
            </h3>
            <p className="text-blue-700 mb-4">
              Scan the QR code or enter the URL manually to connect your iPhone,
              Android, or other devices
            </p>
            <button
              onClick={() => setShowConnectionHelper(true)}
              className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center space-x-2 mx-auto"
            >
              <i className="fas fa-qrcode"></i>
              <span>Show Connection Options</span>
            </button>
          </div>
        )}

        {/* Error Recovery Panel */}
        <ErrorRecoveryPanel
          transfers={fileTransfer.transfers}
          onRetryTransfer={handleRetryTransfer}
          onReduceChunkSize={handleReduceChunkSize}
          onResumeMissingChunks={handleResumeMissingChunks}
          onCancelTransfer={handleCancelTransfer}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>ShareZidi v2.1</span>
              <span>•</span>
              <span>Socket ID: {websocket.userId || "..."}</span>
              <span>•</span>
              <span
                className={
                  websocket.isConnected ? "text-success" : "text-error"
                }
              >
                {websocket.isConnected
                  ? "Connection Stable"
                  : "Connection Lost"}
              </span>
            </div>
            <button className="text-primary hover:text-blue-600 transition-colors">
              <i className="fas fa-cog mr-1"></i>
              Advanced Settings
            </button>
          </div>

          {/* Copyright Notice */}
          <div className="text-center text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
            © {new Date().getFullYear()} ShareZidi. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Connection Helper Modal */}
      <ConnectionHelper
        isVisible={showConnectionHelper}
        onClose={() => setShowConnectionHelper(false)}
      />

      {/* Accessibility Panel */}
      <AccessibilityPanel
        isOpen={showAccessibilityPanel}
        onClose={() => setShowAccessibilityPanel(false)}
      />

      {/* V2 QR Code Modal */}
      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">ShareZidi v2.0 QR Code</h3>
              <button
                onClick={() => setShowQRCode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="text-center">
              {qrCodeData && (
                <img
                  src={qrCodeData}
                  alt="ShareZidi QR Code"
                  className="mx-auto mb-4"
                  style={{ maxWidth: '256px', maxHeight: '256px' }}
                />
              )}
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with another device to connect and transfer files
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleGenerateTransferQR}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Transfer QR
                </button>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip Links for screen readers */}
      <a
        href="#main-content"
        className="skip-link"
        onFocus={(e) => {
          e.currentTarget.scrollIntoView();
        }}
      >
        Skip to main content
      </a>
    </div>
  );
};
