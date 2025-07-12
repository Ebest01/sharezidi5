import { useEffect, useRef } from 'react';

export const useAriaAnnouncements = () => {
  const announcementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcement region for screen readers
    if (!announcementRef.current) {
      const element = document.createElement('div');
      element.setAttribute('aria-live', 'polite');
      element.setAttribute('aria-atomic', 'true');
      element.setAttribute('class', 'sr-only');
      element.setAttribute('id', 'aria-announcements');
      document.body.appendChild(element);
      announcementRef.current = element;
    }

    return () => {
      if (announcementRef.current && document.body.contains(announcementRef.current)) {
        document.body.removeChild(announcementRef.current);
      }
    };
  }, []);

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcementRef.current) {
      // Clear previous announcement
      announcementRef.current.textContent = '';
      announcementRef.current.setAttribute('aria-live', priority);
      
      // Set new announcement after a brief delay to ensure screen reader picks it up
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = message;
        }
      }, 100);
    }
  };

  const announceTransferStart = (deviceName: string, fileCount: number) => {
    announce(`Transfer started to ${deviceName}. Sending ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.`);
  };

  const announceTransferComplete = (deviceName: string) => {
    announce(`Transfer to ${deviceName} completed successfully.`, 'assertive');
  };

  const announceTransferError = (error: string) => {
    announce(`Transfer error: ${error}`, 'assertive');
  };

  const announceDeviceConnected = (deviceName: string) => {
    announce(`Device ${deviceName} connected.`);
  };

  const announceDeviceDisconnected = (deviceName: string) => {
    announce(`Device ${deviceName} disconnected.`);
  };

  const announceFileSelected = (fileName: string) => {
    announce(`File ${fileName} selected.`);
  };

  const announceFileRemoved = (fileName: string) => {
    announce(`File ${fileName} removed.`);
  };

  const announceAccessibilityModeChange = (mode: string) => {
    announce(`Accessibility mode changed to ${mode}.`);
  };

  return {
    announce,
    announceTransferStart,
    announceTransferComplete,
    announceTransferError,
    announceDeviceConnected,
    announceDeviceDisconnected,
    announceFileSelected,
    announceFileRemoved,
    announceAccessibilityModeChange
  };
};