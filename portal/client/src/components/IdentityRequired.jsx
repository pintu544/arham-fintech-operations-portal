import { UserRoundCheck } from 'lucide-react'
import IdentitySelector from './IdentitySelector'

export default function IdentityRequired() {
  return (
    <section className="empty-state identity-required" aria-labelledby="identity-required-title">
      <UserRoundCheck size={48} className="empty-icon" />
      <div id="identity-required-title" className="empty-title">Select an employee</div>
      <div className="empty-desc">Choose a validated demo identity below to open the internal portal.</div>
      <IdentitySelector id="page-demo-identity" className="identity-required-selector" label="Choose identity" showRole={false} />
    </section>
  )
}
