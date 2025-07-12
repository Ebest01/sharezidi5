import React from 'react';
import { useAccessibility } from '@/hooks/useAccessibility';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Eye, 
  EyeOff, 
  Palette, 
  Type, 
  MousePointer, 
  Volume2,
  Settings,
  Monitor,
  Moon,
  Sun
} from 'lucide-react';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const {
    settings,
    toggleMode,
    toggleReduceMotion,
    toggleLargeText,
    toggleScreenReaderMode,
    isHighContrast,
    isDarkHighContrast
  } = useAccessibility();

  if (!isOpen) return null;

  const getModeIcon = () => {
    switch (settings.mode) {
      case 'high-contrast': return <Sun className="h-4 w-4" />;
      case 'dark-high-contrast': return <Moon className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getModeLabel = () => {
    switch (settings.mode) {
      case 'high-contrast': return 'High Contrast Light';
      case 'dark-high-contrast': return 'High Contrast Dark';
      default: return 'Normal';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-panel-title"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="accessibility-panel-title" className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Accessibility Settings
          </CardTitle>
          <CardDescription>
            Customize ShareZidi for better accessibility and usability
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Display Mode */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Display Mode
            </Label>
            <Button
              onClick={toggleMode}
              variant="outline"
              className="w-full justify-start"
              aria-label={`Current display mode: ${getModeLabel()}. Click to cycle through modes.`}
            >
              {getModeIcon()}
              <span className="ml-2">{getModeLabel()}</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              Cycles between normal, high contrast light, and high contrast dark themes
            </p>
          </div>

          <Separator />

          {/* Reduce Motion */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label 
                htmlFor="reduce-motion" 
                className="text-sm font-medium flex items-center gap-2"
              >
                <MousePointer className="h-4 w-4" />
                Reduce Motion
              </Label>
              <p className="text-xs text-muted-foreground">
                Minimizes animations and transitions
              </p>
            </div>
            <Switch
              id="reduce-motion"
              checked={settings.reduceMotion}
              onCheckedChange={toggleReduceMotion}
              aria-describedby="reduce-motion-desc"
            />
          </div>

          <Separator />

          {/* Large Text */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label 
                htmlFor="large-text" 
                className="text-sm font-medium flex items-center gap-2"
              >
                <Type className="h-4 w-4" />
                Large Text
              </Label>
              <p className="text-xs text-muted-foreground">
                Increases text size by 20%
              </p>
            </div>
            <Switch
              id="large-text"
              checked={settings.largeText}
              onCheckedChange={toggleLargeText}
              aria-describedby="large-text-desc"
            />
          </div>

          <Separator />

          {/* Screen Reader Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label 
                htmlFor="screen-reader" 
                className="text-sm font-medium flex items-center gap-2"
              >
                <Volume2 className="h-4 w-4" />
                Screen Reader Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Enhanced announcements and navigation
              </p>
            </div>
            <Switch
              id="screen-reader"
              checked={settings.screenReaderMode}
              onCheckedChange={toggleScreenReaderMode}
              aria-describedby="screen-reader-desc"
            />
          </div>

          <Separator />

          {/* Keyboard Navigation Info */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Keyboard Navigation</Label>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Tab: Navigate between elements</p>
              <p>• Enter/Space: Activate buttons</p>
              <p>• Escape: Close dialogs</p>
              <p>• Alt + A: Open accessibility panel</p>
            </div>
          </div>

          {/* Close Button */}
          <Button 
            onClick={onClose} 
            className="w-full"
            aria-label="Close accessibility settings"
          >
            Close Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};