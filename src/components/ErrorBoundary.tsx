import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Auto-reload on dynamic import failure (usually means a new version was deployed)
    if (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ) {
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'var(--orange-subtle)',
            border: '1px solid var(--orange-border)',
            padding: '40px',
            borderRadius: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-card)'
          }}>
            <h1 style={{ 
              color: 'var(--orange)', 
              margin: '0 0 16px 0',
              fontSize: '28px',
              fontWeight: 600,
              letterSpacing: '-0.5px'
            }}>
              Oops! Algo deu errado.
            </h1>
            <p style={{ 
              color: 'var(--text-secondary)',
              margin: '0 0 24px 0',
              lineHeight: 1.6,
              fontSize: '15px'
            }}>
              Ocorreu um erro inesperado no aplicativo. Nossa equipe técnica já foi notificada.
            </p>
            <div style={{
              background: 'var(--bg-input)',
              padding: '16px',
              borderRadius: '12px',
              overflowX: 'auto',
              marginBottom: '32px',
              textAlign: 'left',
              border: '1px solid var(--border-subtle)'
            }}>
              <code style={{ 
                color: 'var(--orange)', 
                fontSize: '13px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              }}>
                {this.state.error?.message || 'Unknown Error'}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--orange)',
                color: 'var(--text-primary)',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--orange)';
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--orange)';
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(1px)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            >
              Recarregar a página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
