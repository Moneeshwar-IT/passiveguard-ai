import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught React render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-8 rounded-xl shadow-md max-w-md space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto text-[#DC2626] font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-[#0F172A] font-mono">CONSOLE INITIALIZATION ERROR</h2>
            <p className="text-xs text-[#64748B] font-mono leading-relaxed">
              {this.state.error?.message || 'A runtime rendering exception occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors shadow-xs"
            >
              Reload Security Console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
