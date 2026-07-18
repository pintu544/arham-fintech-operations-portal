import { AlertTriangle } from 'lucide-react'

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state error-state" role="alert">
      <AlertTriangle size={48} className="empty-icon" />
      <div className="empty-title">Unable to load data</div>
      <div className="empty-desc">{message}</div>
      {onRetry && <button className="btn btn-primary" onClick={onRetry}>Try again</button>}
    </div>
  )
}
