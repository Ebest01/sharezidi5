import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, Download, Smartphone, Monitor, Tablet, Zap } from "lucide-react";

export default function ShareZidiApp() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDevices] = useState([
    { id: "1", name: "iPhone 15", type: "mobile", online: true },
    { id: "2", name: "MacBook Pro", type: "laptop", online: true },
    { id: "3", name: "iPad Air", type: "tablet", online: false },
  ]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile": return <Smartphone className="h-4 w-4" />;
      case "laptop": return <Monitor className="h-4 w-4" />;
      case "tablet": return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Home
                </Button>
              </Link>
              <img 
                src="/assets/sharezidi-logo.gif" 
                alt="ShareZidi" 
                className="h-10 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Connected</span>
              </div>
              <Link href="/auth">
                <Button variant="outline" size="sm">Account</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* File Selection */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  Select Files to Share
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-600 mb-2">
                    Drag and drop files here
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    or click to browse your files
                  </p>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
                    Choose Files
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Selected Files */}
                {selectedFiles.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">Selected Files ({selectedFiles.length})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Download className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        disabled={selectedFiles.length === 0}
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Start Transfer ({selectedFiles.length} files)
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Connected Devices */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Monitor className="mr-2 h-5 w-5" />
                    Connected Devices
                  </span>
                  <span className="text-sm font-normal text-gray-600">
                    {connectedDevices.filter(d => d.online).length} online
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {connectedDevices.map((device) => (
                    <div 
                      key={device.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        device.online 
                          ? 'bg-green-50 border-green-200 cursor-pointer hover:bg-green-100' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          device.online ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {getDeviceIcon(device.type)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{device.name}</p>
                          <p className={`text-xs ${
                            device.online ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {device.online ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                      {device.online && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )}
                    </div>
                  ))}
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => setIsConnecting(!isConnecting)}
                >
                  {isConnecting ? "Scanning..." : "Refresh Devices"}
                </Button>
              </CardContent>
            </Card>

            {/* Transfer Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Transfer Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Files Shared Today</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Data Transferred</span>
                    <span className="font-medium">2.4 GB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Average Speed</span>
                    <span className="font-medium">45 MB/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Success Rate</span>
                    <span className="font-medium text-green-600">99.8%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}