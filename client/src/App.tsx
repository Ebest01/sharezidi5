import { useState } from "react";
import { ShareZidiApp } from "./components/ShareZidiApp";
import AuthPage from "./pages/auth-page";
import "./index.css";

function App() {
  // Simple state-based routing for auth
  const [showAuth, setShowAuth] = useState(window.location.pathname === '/auth');

  if (showAuth) {
    return <AuthPage onAuthSuccess={() => setShowAuth(false)} />;
  }

  return <ShareZidiApp />;
}

export default App;
