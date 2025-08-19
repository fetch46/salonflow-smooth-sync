import { useMemo, useState } from 'react'
import ActionsDropdown, { DropdownAction } from '../components/ActionsDropdown'

export interface OrganizationUser {
  id: string
  name: string
  email: string
  role: 'Owner' | 'Admin' | 'Member'
  status: 'Active' | 'Invited' | 'Suspended'
}

const SAMPLE_USERS: OrganizationUser[] = [
  { id: 'u_1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Owner', status: 'Active' },
  { id: 'u_2', name: 'Bob Smith', email: 'bob@example.com', role: 'Admin', status: 'Invited' },
  { id: 'u_3', name: 'Carol Davis', email: 'carol@example.com', role: 'Member', status: 'Active' },
  { id: 'u_4', name: 'Diego Lee', email: 'diego@example.com', role: 'Member', status: 'Suspended' },
]

export default function UsersTable() {
  const [users, setUsers] = useState<OrganizationUser[]>(SAMPLE_USERS)

  function updateUser(id: string, updater: (u: OrganizationUser) => OrganizationUser) {
    setUsers((prev) => prev.map((u) => (u.id === id ? updater(u) : u)))
  }

  function removeUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  function buildActionsForUser(user: OrganizationUser): DropdownAction[] {
    const actions: DropdownAction[] = []

    if (user.status !== 'Suspended') {
      actions.push({
        label: 'Suspend user',
        destructive: true,
        onSelect: () => updateUser(user.id, (u) => ({ ...u, status: 'Suspended' })),
      })
    } else {
      actions.push({
        label: 'Unsuspend user',
        onSelect: () => updateUser(user.id, (u) => ({ ...u, status: 'Active' })),
      })
    }

    actions.push({
      label: 'Reset password',
      onSelect: () => window.alert(`Password reset email sent to ${user.email}`),
    })

    if (user.role !== 'Owner') {
      actions.push({
        label: 'Promote to Admin',
        onSelect: () => updateUser(user.id, (u) => ({ ...u, role: 'Admin' })),
      })
    }

    actions.push({
      label: 'Remove from organization',
      destructive: true,
      onSelect: () => removeUser(user.id),
    })

    return actions
  }

  const tableRows = useMemo(() => users.map((user) => {
    const actions = buildActionsForUser(user)
    return (
      <tr key={user.id}>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700 }}>{user.name}</span>
            <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>{user.email}</span>
          </div>
        </td>
        <td>{user.role}</td>
        <td>{user.status}</td>
        <td style={{ textAlign: 'right' }}>
          <ActionsDropdown actions={actions} />
        </td>
      </tr>
    )
  }), [users])

  return (
    <div style={{ width: '100%', maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h2 style={{ margin: '0 0 12px' }}>Organization Users</h2>
      <p style={{ margin: '0 0 20px', color: 'var(--color-muted)' }}>
        Manage members of this organization. All per-row actions have been consolidated under a single Actions button.
      </p>
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--color-surface)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-2)' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>User</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Role</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Status</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableRows}
          </tbody>
        </table>
      </div>
    </div>
  )
}

