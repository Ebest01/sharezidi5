import { createRoot } from "https://esm.sh/react-dom@18/client";
import React from "https://esm.sh/react@18";

// Simple React app without TypeScript complexity
function App() {
  return React.createElement('div', { 
    style: { 
      fontFamily: 'Arial, sans-serif', 
      textAlign: 'center', 
      padding: '50px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white'
    }
  }, [
    React.createElement('h1', { key: 'title' }, 'ShareZidi - Real-time File Transfer'),
    React.createElement('p', { key: 'subtitle', style: { fontSize: '18px', margin: '20px 0' } }, 
      'Professional file sharing application'),
    React.createElement('div', { key: 'buttons', style: { marginTop: '30px' } }, [
      React.createElement('a', { 
        key: 'auth',
        href: '/auth',
        style: {
          display: 'inline-block',
          padding: '12px 24px',
          margin: '0 10px',
          background: '#fff',
          color: '#667eea',
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold'
        }
      }, 'Login / Register'),
      React.createElement('a', { 
        key: 'start',
        href: '/start',
        style: {
          display: 'inline-block',
          padding: '12px 24px',
          margin: '0 10px',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold',
          border: '2px solid rgba(255,255,255,0.3)'
        }
      }, 'Start Transfer'),
      React.createElement('a', { 
        key: 'db',
        href: '/simpledbtest',
        style: {
          display: 'inline-block',
          padding: '12px 24px',
          margin: '0 10px',
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '5px',
          fontWeight: 'bold'
        }
      }, 'Database Test')
    ])
  ]);
}

// Initialize React app
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(App));