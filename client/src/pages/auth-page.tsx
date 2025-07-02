import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Lock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Form schemas
const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const loginSchema = z.object({
  email: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

const resendSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

interface AuthPageProps {
  onAuthSuccess?: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [activeTab, setActiveTab] = useState("login");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const { toast } = useToast();

  // Registration form
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "" },
  });

  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Change password form
  const changePasswordForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { email: "", currentPassword: "", newPassword: "" },
  });

  // Resend password form
  const resendForm = useForm<z.infer<typeof resendSchema>>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: "" },
  });

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration Successful!",
        description: `Account created for ${data.email}. Check your email for login credentials.`,
      });
      registerForm.reset();
      setActiveTab("login");
      loginForm.setValue("email", data.email);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof loginSchema>) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Login Successful!",
        description: `Welcome back, ${data.user.username || data.user.email}!`,
      });
      loginForm.reset();
      // Call parent callback to go back to main app
      if (onAuthSuccess) {
        onAuthSuccess();
      } else {
        window.location.href = "/";
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof changePasswordSchema>) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Changed!",
        description: "Your password has been updated successfully.",
      });
      changePasswordForm.reset();
      setShowChangePassword(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Password Change Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resend password mutation
  const resendMutation = useMutation({
    mutationFn: async (data: z.infer<typeof resendSchema>) => {
      const res = await apiRequest("POST", "/api/auth/resend-password", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "New Password Sent!",
        description: `A new password has been sent to ${data.emailSent ? 'your email' : 'the console (check logs)'}.`,
      });
      resendForm.reset();
      setShowResend(false);
      setActiveTab("login");
    },
    onError: (error: Error) => {
      toast({
        title: "Resend Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (showChangePassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your current password with a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...changePasswordForm}>
              <form onSubmit={changePasswordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={changePasswordForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={changePasswordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Current password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={changePasswordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="New password (min 6 characters)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowChangePassword(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showResend) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Resend Password
            </CardTitle>
            <CardDescription>
              Get a new password sent to your email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...resendForm}>
              <form onSubmit={resendForm.handleSubmit((data) => resendMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={resendForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={resendMutation.isPending}
                  >
                    {resendMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send New Password"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowResend(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Hero Section */}
        <div className="text-center lg:text-left space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Welcome to ShareZidi
            </h1>
            <p className="text-xl text-muted-foreground">
              Fast, secure file sharing between your devices
            </p>
          </div>
          <div className="space-y-4 text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Instant file transfers via WebSocket</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Works on mobile, tablet, and desktop</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>No file size limits, no cloud storage</span>
            </div>
          </div>
        </div>

        {/* Auth Forms */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Create an account or sign in to start sharing files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="register" className="space-y-4">
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    Just enter your email - we'll send you a password instantly!
                  </AlertDescription>
                </Alert>
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your@email.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="login" className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                  <Lock className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Use your email and the password sent to your inbox. 
                    <span className="text-xs text-muted-foreground block mt-1">
                      Dev admin: AxDMIxN / AZQ00001xx
                    </span>
                  </AlertDescription>
                </Alert>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email or Username</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="your@email.com or username"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Password from email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </Form>
                <div className="space-y-2 text-center">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowResend(true)}
                    className="text-sm"
                  >
                    Didn't receive your password? Resend
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowChangePassword(true)}
                    className="text-sm"
                  >
                    Change Password
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}