import React from 'react';

interface State { error: Error | null; info: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: string }, State> {
    state: State = { error: null, info: '' };

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        this.setState({ error, info: info.componentStack || '' });
        console.error('[ErrorBoundary] Caught error:', error.message, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 24, background: '#1a1a2e', minHeight: '100vh', color: '#fff', fontFamily: 'monospace' }}>
                    <div style={{ background: '#e53e3e', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>🔴 Erro no Componente</h2>
                        <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9 }}>{this.state.error.message}</p>
                    </div>
                    <details style={{ background: '#16213e', padding: 16, borderRadius: 8 }}>
                        <summary style={{ cursor: 'pointer', color: '#90cdf4' }}>📋 Stack Trace (clique para ver)</summary>
                        <pre style={{ fontSize: 11, overflow: 'auto', marginTop: 8, color: '#fbb6ce' }}>
                            {this.state.error.stack}
                        </pre>
                        <pre style={{ fontSize: 11, overflow: 'auto', color: '#9ae6b4' }}>
                            {this.state.info}
                        </pre>
                    </details>
                    <button
                        onClick={() => this.setState({ error: null, info: '' })}
                        style={{ marginTop: 16, padding: '8px 16px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                        ← Voltar ao Menu
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
