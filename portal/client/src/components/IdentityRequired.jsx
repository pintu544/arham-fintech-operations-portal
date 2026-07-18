import { UserRoundCheck } from 'lucide-react'

export default function IdentityRequired() {
  return (
    <div className="empty-state" role="status">
      <UserRoundCheck size={48} className="empty-icon" />
      <div className="empty-title">Select an employee</div>
      <div className="empty-desc">Choose a validated demo identity from the header to open the internal portal.</div>
    </div>
  )
}
