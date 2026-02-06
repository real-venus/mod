"use client";

import { useState } from 'react'
import { UserType } from '@/mod/types'
import { userContext } from '@/mod/context'
import { Shield, Users, X, Plus, Trash2, Save } from 'lucide-react'

interface AdminProps {
  userData: UserType
}

type Role = 'admin' | 'moderator' | 'user' | 'viewer'
type Permission = 'read' | 'write' | 'delete' | 'manage_users' | 'manage_roles'

interface UserRole {
  address: string
  role: Role
  permissions: Permission[]
}

export function Admin({ userData }: AdminProps) {
  const { client, user } = userContext()
  const [userRoles, setUserRoles] = useState<UserRole[]>(userData.user_roles || [])
  const [newUserAddress, setNewUserAddress] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>('user')
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['read'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const availableRoles: Role[] = ['admin', 'moderator', 'user', 'viewer']
  const availablePermissions: Permission[] = ['read', 'write', 'delete', 'manage_users', 'manage_roles']

  const roleColors: Record<Role, string> = {
    admin: 'text-red-400 border-red-500/40 bg-red-500/10',
    moderator: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
    user: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    viewer: 'text-gray-400 border-gray-500/40 bg-gray-500/10'
  }

  const handleAddUser = () => {
    if (newUserAddress.trim() && !userRoles.find(u => u.address === newUserAddress.trim())) {
      setUserRoles([...userRoles, {
        address: newUserAddress.trim(),
        role: selectedRole,
        permissions: selectedPermissions
      }])
      setNewUserAddress('')
      setSelectedPermissions(['read'])
    }
  }

  const handleRemoveUser = (address: string) => {
    setUserRoles(userRoles.filter(u => u.address !== address))
  }

  const handleUpdateRole = (address: string, newRole: Role) => {
    setUserRoles(userRoles.map(u => 
      u.address === address ? { ...u, role: newRole } : u
    ))
  }

  const handleTogglePermission = (address: string, permission: Permission) => {
    setUserRoles(userRoles.map(u => {
      if (u.address === address) {
        const hasPermission = u.permissions.includes(permission)
        return {
          ...u,
          permissions: hasPermission 
            ? u.permissions.filter(p => p !== permission)
            : [...u.permissions, permission]
        }
      }
      return u
    }))
  }

  const handleSaveRoles = async () => {
    if (!client) return
    
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await client.call('update_user_roles', {
        user_roles: userRoles
      })
      setSuccess('User roles and permissions updated successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err?.message || 'Failed to update user roles')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">


      <div className="bg-black/60 border-2 border-purple-500/40 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-xl font-bold text-purple-300 mb-4 uppercase tracking-wide">
            Manage User Roles & Permissions
          </h3>
          <p className="text-purple-400/80 text-sm mb-4">
            Assign roles and granular permissions to users for fine-grained access control.
          </p>
        </div>

        {/* Add New User */}
        <div className="space-y-3 p-4 bg-black/40 border border-purple-500/30 rounded-lg">
          <h4 className="text-sm font-bold text-purple-300 uppercase">Add New User</h4>
          
          <input
            type="text"
            value={newUserAddress}
            onChange={(e) => setNewUserAddress(e.target.value)}
            placeholder="Enter user address..."
            disabled={loading}
            className="w-full bg-black/60 border-2 border-purple-500/40 rounded-lg px-4 py-3 text-purple-300 font-mono text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 transition-all placeholder-purple-500/40"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-purple-400 font-bold uppercase mb-2 block">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                disabled={loading}
                className="w-full bg-black/60 border-2 border-purple-500/40 rounded-lg px-4 py-2 text-purple-300 font-mono text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
              >
                {availableRoles.map(role => (
                  <option key={role} value={role}>{role.toUpperCase()}</option>
                ))}
              </select>
            </div>

          </div>

          <button
            onClick={handleAddUser}
            disabled={!newUserAddress.trim() || loading}
            className="w-full px-6 py-3 bg-purple-500/20 border-2 border-purple-500/50 rounded-lg text-purple-300 font-bold hover:bg-purple-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>

        {/* User List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {userRoles.map((userRole, idx) => (
            <div
              key={idx}
              className="p-4 bg-black/60 border-2 border-purple-500/30 rounded-lg hover:border-purple-500/50 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <code className="text-sm text-purple-300 font-mono break-all flex-1">{userRole.address}</code>
                <button
                  onClick={() => handleRemoveUser(userRole.address)}
                  disabled={loading}
                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors ml-4 flex-shrink-0"
                >
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-400 font-bold uppercase">Role:</span>
                <select
                  value={userRole.role}
                  onChange={(e) => handleUpdateRole(userRole.address, e.target.value as Role)}
                  disabled={loading}
                  className={`px-3 py-1 rounded-lg border-2 font-mono text-xs ${roleColors[userRole.role]}`}
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{role.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-xs text-purple-400 font-bold uppercase block mb-2">Permissions:</span>
                <div className="flex flex-wrap gap-2">
                  {availablePermissions.map(perm => (
                    <label key={perm} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={userRole.permissions.includes(perm)}
                        onChange={() => handleTogglePermission(userRole.address, perm)}
                        disabled={loading}
                        className="accent-purple-500"
                      />
                      <span className="text-purple-300">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {userRoles.length === 0 && (
            <div className="text-center py-8 text-purple-400/60">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-mono">No user roles configured yet</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border-2 border-red-500/40 rounded-lg">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/10 border-2 border-green-500/40 rounded-lg">
            <p className="text-green-400 font-mono text-sm">{success}</p>
          </div>
        )}

        <button
          onClick={handleSaveRoles}
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/60 rounded-lg text-purple-300 font-bold uppercase tracking-wider hover:bg-purple-500/30 hover:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Roles & Permissions</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
