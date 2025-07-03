import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AuthPage from "./auth-page";
import { 
  Zap, 
  Shield, 
  Smartphone, 
  Users, 
  Send, 
  Clock,
  Star,
  ArrowRight
} from "lucide-react";

interface LandingPageProps {
  onAuthSuccess: () => void;
}

export default function LandingPage({ onAuthSuccess }: LandingPageProps) {
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) {
    return <AuthPage onAuthSuccess={onAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950 dark:via-gray-900 dark:to-blue-950">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Send className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                ShareZidi
              </h1>
              <p className="text-xs text-muted-foreground">File Transfer Made Simple</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowAuth(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            Login / Sign Up
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <Zap className="mr-1 h-3 w-3" />
              Real-time File Transfer
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
              Share Files Instantly
              <br />
              Across Your Devices
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Fast, secure, and simple file sharing with real-time transfers. 
              No USB cables, no cloud storage limits, just instant device-to-device sharing.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              onClick={() => setShowAuth(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 py-6"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Quick and Easy • Start in seconds</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why Choose ShareZidi?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for modern file sharing with cutting-edge technology and user-friendly design.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                WebSocket-powered real-time transfers with optimized chunking for maximum speed.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Direct device-to-device transfers with no cloud storage. Your files never leave your network.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <Smartphone className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Cross-Platform</CardTitle>
              <CardDescription>
                Works seamlessly between mobile, tablet, laptop, and desktop devices.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle>Instant Setup</CardTitle>
              <CardDescription>
                No downloads, no installations. Just open the app and start sharing immediately.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
                <Send className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle>Smart Compression</CardTitle>
              <CardDescription>
                Automatic ZIP compression for multiple files with progress tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center mb-4">
                <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <CardTitle>Error Recovery</CardTitle>
              <CardDescription>
                Advanced retry logic and chunk recovery ensures reliable transfers even on poor networks.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Share Files Instantly?</h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of users who trust ShareZidi for fast, secure file transfers.
          </p>
          <Button 
            size="lg" 
            onClick={() => setShowAuth(true)}
            variant="secondary"
            className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-6"
          >
            Start Sharing Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm dark:bg-gray-900/80 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ShareZidi. Built for seamless file sharing.</p>
        </div>
      </footer>
    </div>
  );
}