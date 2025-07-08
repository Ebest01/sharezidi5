import { Route, Switch } from "wouter";
import LandingPage from "./pages/landing-page";
import AuthPage from "./pages/auth-page";
import ShareZidiApp from "./components/ShareZidiApp";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/start" component={ShareZidiApp} />
      <Route path="/login" component={AuthPage} />
      <Route>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
            <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
            <a href="/" className="text-blue-600 hover:text-blue-800">Go Home</a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}