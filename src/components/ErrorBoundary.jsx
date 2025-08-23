import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error){ return { hasError: true, error } }
  componentDidCatch(error, info){ console.error('ErrorBoundary caught:', error, info) }
  render(){
    if(this.state.hasError){
      return (
        <div className="card">
          <h2>😅 Något gick fel</h2>
          <p className="tiny">Prova att gå tillbaka hem och starta om.</p>
          <pre className="tiny" style={{whiteSpace:'pre-wrap'}}>{String(this.state.error)}</pre>
          <button className="btn small" onClick={()=>location.reload()}>🔄 Ladda om</button>
        </div>
      )
    }
    return this.props.children
  }
}