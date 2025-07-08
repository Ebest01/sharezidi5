import React, { useState, useEffect } from 'react';

interface ConnectionHelperProps {
  isVisible: boolean;
  onClose: () => void;
}

export const ConnectionHelper: React.FC<ConnectionHelperProps> = ({ isVisible, onClose }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [localUrls, setLocalUrls] = useState<string[]>([]);

  useEffect(() => {
    if (isVisible) {
      generateConnectionInfo();
    }
  }, [isVisible]);

  const generateConnectionInfo = async () => {
    try {
      const currentUrl = window.location.href;
      const hostname = window.location.hostname;
      
      // Determine if we're on a public domain or local development
      const isPublicDomain = hostname.includes('.replit.app') || 
                           hostname.includes('.repl.co') || 
                           !hostname.includes('localhost') && 
                           !hostname.includes('127.0.0.1') && 
                           !hostname.startsWith('192.168.') && 
                           !hostname.startsWith('10.');

      let urls = [];
      
      if (isPublicDomain) {
        // Use the current public URL
        urls = [currentUrl];
      } else {
        // Try to get network info from server for local development
        try {
          const networkResponse = await fetch('/api/network-info');
          if (networkResponse.ok) {
            const networkData = await networkResponse.json();
            urls = [...networkData.urls, currentUrl];
          } else {
            urls = [currentUrl];
          }
        } catch {
          urls = [currentUrl];
        }
      }
      
      setLocalUrls(urls);

      // Generate QR code for the first URL
      const mainUrl = urls[0];
      try {
        const qrResponse = await fetch('/api/generate-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: mainUrl })
        });

        if (qrResponse.ok) {
          const qrData = await qrResponse.text();
          setQrCodeUrl(qrData);
        }
      } catch (error) {
        console.log('QR generation failed, continuing without QR code');
      }
    } catch (error) {
      console.error('Failed to generate connection info:', error);
      setLocalUrls([window.location.href]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Connect Your Mobile Device</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="space-y-4">
          {/* QR Code Section */}
          {qrCodeUrl && (
            <div className="text-center">
              <h4 className="font-medium text-gray-700 mb-2">Scan QR Code</h4>
              <div className="bg-white p-4 rounded-lg border inline-block">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Scan with your phone's camera to open ShareZidi
              </p>
            </div>
          )}

          {/* Manual URLs */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Or Enter URL Manually:</h4>
            <div className="space-y-2">
              {localUrls.map((url, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={url}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
                  />
                  <button
                    onClick={() => copyToClipboard(url)}
                    className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-blue-600"
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Connection Steps:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Deploy this app to get a public URL (click Deploy button)</li>
              <li>2. Scan the QR code or enter the public URL in Safari</li>
              <li>3. Both devices will appear in each other's device list</li>
              <li>4. Select files and send them between devices</li>
            </ol>
          </div>

          {/* Deployment Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <i className="fas fa-exclamation-triangle text-yellow-600 mt-0.5"></i>
              <div>
                <h4 className="font-medium text-yellow-800 mb-1">Public Access Required</h4>
                <p className="text-sm text-yellow-700">
                  The current development server isn't accessible from external devices. 
                  Deploy the app to get a public URL that works with mobile devices.
                </p>
              </div>
            </div>
          </div>

          {/* Network Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-2">Network Requirements:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Both devices must be on the same WiFi network</li>
              <li>• Make sure firewall allows local connections</li>
              <li>• If connection fails, try refreshing both pages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};