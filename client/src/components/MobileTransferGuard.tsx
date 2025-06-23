import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, Smartphone, Battery } from 'lucide-react';

interface MobileTransferGuardProps {
  isTransferring: boolean;
  onWakeLockRequested?: () => void;
}

export const MobileTransferGuard: React.FC<MobileTransferGuardProps> = ({
  isTransferring,
  onWakeLockRequested
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Detect mobile device
    const userAgent = navigator.userAgent;
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    setIsMobile(mobile);
  }, []);

  useEffect(() => {
    if (isMobile && isTransferring) {
      setShowWarning(true);
      onWakeLockRequested?.();
      
      // Auto-hide warning after 8 seconds
      const timer = setTimeout(() => {
        setShowWarning(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    } else {
      setShowWarning(false);
    }
  }, [isMobile, isTransferring, onWakeLockRequested]);

  if (!showWarning) return null;

  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="h-4 w-4" />
          <span className="font-medium">Mobile Transfer Active</span>
        </div>
        <div className="text-sm space-y-1">
          <div className="flex items-center gap-2">
            <Battery className="h-3 w-3" />
            <span>Keep screen on during transfer</span>
          </div>
          <div>• Don't switch apps or lock phone</div>
          <div>• Transfer will pause if phone goes to sleep</div>
        </div>
      </AlertDescription>
    </Alert>
  );
};