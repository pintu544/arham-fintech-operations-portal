import { useAuth } from '../contexts/AuthContext'

function roleLabel(role) {
  return role === 'management' ? 'Management' : 'Relationship Manager'
}

export default function IdentitySelector({
  id = 'demo-identity',
  className = '',
  label = 'View as',
  showRole = true
}) {
  const {
    employees = [],
    currentUser,
    login = () => {},
    logout = () => {},
    directoryError = ''
  } = useAuth()

  const management = employees.filter(employee => employee.role === 'management')
  const relationshipManagers = employees.filter(employee => employee.role === 'relationship_manager')
  const errorId = `${id}-error`

  const handleChange = event => {
    const employeeId = event.target.value
    if (!employeeId) return logout()
    const employee = employees.find(item => item.employeeId === employeeId)
    if (employee) login(employee)
  }

  return (
    <div className={`role-selector ${className}`.trim()}>
      {label && <label className="role-label" htmlFor={id}>{label}</label>}
      <select
        id={id}
        value={currentUser?.employeeId || ''}
        onChange={handleChange}
        aria-label="Select demo identity"
        aria-describedby={directoryError ? errorId : undefined}
        disabled={employees.length === 0 && !directoryError}
      >
        <option value="">
          {directoryError ? 'Identity directory unavailable' : employees.length === 0 ? 'Loading identities…' : 'Select employee…'}
        </option>
        {management.length > 0 && (
          <optgroup label="Management">
            {management.map(employee => <option key={employee.employeeId} value={employee.employeeId}>{employee.name} ({employee.employeeId})</option>)}
          </optgroup>
        )}
        {relationshipManagers.length > 0 && (
          <optgroup label="Relationship Managers">
            {relationshipManagers.map(employee => <option key={employee.employeeId} value={employee.employeeId}>{employee.name} ({employee.employeeId})</option>)}
          </optgroup>
        )}
      </select>
      {showRole && currentUser && (
        <span className={`identity-role-badge ${currentUser.role}`}>
          {roleLabel(currentUser.role)}
        </span>
      )}
      {directoryError && <span id={errorId} className="sr-only">{directoryError}</span>}
    </div>
  )
}
