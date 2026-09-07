import { useEffect, useState } from 'react'
import { useOsc } from '../hooks/useOscario'
import {
  apiListUsers, apiCreateUser, apiUpdateUser, apiDeleteUser, apiResetUserPassword,
} from '../api'
import { TAB_OPTIONS } from '../constants'
import type { AppUser, UserRole, TabId } from '../types'
import ConfirmModal from './ConfirmModal'

interface ResetTarget { userId: number; username: string }

export default function UsersAdmin() {
  const { addToast } = useOsc()
  const [users,   setUsers]   = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [newUsername,    setNewUsername]    = useState('')
  const [newPassword,    setNewPassword]    = useState('')
  const [newRole,        setNewRole]        = useState<UserRole>('user')
  const [newPermissions, setNewPermissions] = useState<TabId[]>(['ctrl'])
  const [creating,       setCreating]       = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null)
  const [resetTarget,   setResetTarget]   = useState<ResetTarget | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading,  setResetLoading]  = useState(false)

  function toggleNewPermission(tab: TabId) {
    setNewPermissions(prev => prev.includes(tab) ? prev.filter(t => t !== tab) : [...prev, tab])
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      setUsers(await apiListUsers())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newUsername.trim() || newPassword.length < 6) {
      addToast('off', 'Usuario y contraseña (mín. 6 caracteres) son obligatorios')
      return
    }
    if (newRole === 'user' && newPermissions.length === 0) {
      addToast('off', 'Selecciona al menos una sección del menú')
      return
    }
    setCreating(true)
    try {
      await apiCreateUser(newUsername.trim(), newPassword, newRole, newPermissions)
      setNewUsername('')
      setNewPassword('')
      setNewRole('user')
      setNewPermissions(['ctrl'])
      addToast('ok', 'Usuario creado')
      await load()
    } catch (e: unknown) {
      addToast('off', e instanceof Error ? e.message : 'Error al crear usuario')
    } finally {
      setCreating(false)
    }
  }

  async function togglePermission(u: AppUser, tab: TabId) {
    const next = u.permissions.includes(tab)
      ? u.permissions.filter(t => t !== tab)
      : [...u.permissions, tab]
    try {
      await apiUpdateUser(u.id, { permissions: next })
      await load()
    } catch (e: unknown) {
      addToast('off', e instanceof Error ? e.message : 'No se pudo actualizar los permisos')
    }
  }

  async function toggleActive(u: AppUser) {
    try {
      await apiUpdateUser(u.id, { is_active: !u.is_active })
      addToast('ok', u.is_active ? 'Usuario desactivado' : 'Usuario activado')
      await load()
    } catch (e: unknown) {
      addToast('off', e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  async function changeRole(u: AppUser, role: UserRole) {
    if (role === u.role) return
    try {
      await apiUpdateUser(u.id, { role })
      addToast('ok', 'Rol actualizado')
      await load()
    } catch (e: unknown) {
      addToast('off', e instanceof Error ? e.message : 'No se pudo actualizar el rol')
      await load()
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await apiDeleteUser(confirmDelete.id)
      addToast('ok', 'Usuario eliminado')
      await load()
    } catch (e: unknown) {
      addToast('off', e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setConfirmDelete(null)
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || resetPassword.length < 6) {
      addToast('off', 'La contraseña debe tener al menos 6 caracteres')
      return
    }
    setResetLoading(true)
    try {
      await apiResetUserPassword(resetTarget.userId, resetPassword)
      addToast('ok', `Contraseña de ${resetTarget.username} restablecida`)
      setResetTarget(null)
      setResetPassword('')
    } catch (e: unknown) {
      addToast('off', e instanceof Error ? e.message : 'No se pudo restablecer la contraseña')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="users-admin">
      <form className="users-add-form" onSubmit={handleCreate}>
        <input
          className="modal-input"
          placeholder="Usuario"
          value={newUsername}
          onChange={e => setNewUsername(e.target.value)}
          maxLength={64}
        />
        <input
          className="modal-input"
          type="password"
          placeholder="Contraseña (mín. 6)"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <select
          className="modal-input users-role-select"
          value={newRole}
          onChange={e => setNewRole(e.target.value as UserRole)}
        >
          <option value="user">Usuario</option>
          <option value="admin">Administrador</option>
        </select>
        {newRole === 'user' && (
          <div className="users-perms-group">
            {TAB_OPTIONS.map(t => (
              <label key={t.id} className="users-perm-chip">
                <input
                  type="checkbox"
                  checked={newPermissions.includes(t.id)}
                  onChange={() => toggleNewPermission(t.id)}
                />
                <i className={`fa-solid ${t.icon}`} /> {t.label}
              </label>
            ))}
          </div>
        )}
        <button
          className="settings-btn"
          style={{ color: 'var(--teal)', borderColor: 'var(--teal)', background: 'rgba(38,166,154,.1)' }}
          disabled={creating}
          type="submit"
        >
          {creating
            ? <><i className="fa-solid fa-spinner fa-spin" /> Creando…</>
            : <><i className="fa-solid fa-user-plus" /> Añadir</>}
        </button>
      </form>

      {error && <div className="settings-output err">{error}</div>}

      {loading ? (
        <div className="users-loading"><i className="fa-solid fa-spinner fa-spin" /> Cargando usuarios…</div>
      ) : (
        <div className="users-list">
          {users.map(u => (
            <div key={u.id} className="users-row">
              <div className="users-row-main">
                <div className="users-row-name">
                  {u.username}
                  <span className={`users-badge ${u.role}`}>{u.role === 'admin' ? 'Admin' : 'Usuario'}</span>
                  {!u.is_active && <span className="users-badge inactive">Inactivo</span>}
                </div>
                <div className="users-row-meta">
                  Creado: {new Date(u.created_at).toLocaleString()}
                </div>
              </div>
              <div className="users-row-actions">
                <select
                  className="users-role-select"
                  value={u.role}
                  onChange={e => changeRole(u, e.target.value as UserRole)}
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
                <button
                  className="users-icon-btn"
                  title={u.is_active ? 'Desactivar' : 'Activar'}
                  onClick={() => toggleActive(u)}
                >
                  <i className={`fa-solid ${u.is_active ? 'fa-user-slash' : 'fa-user-check'}`} />
                </button>
                <button
                  className="users-icon-btn"
                  title="Restablecer contraseña"
                  onClick={() => { setResetTarget({ userId: u.id, username: u.username }); setResetPassword('') }}
                >
                  <i className="fa-solid fa-key" />
                </button>
                <button
                  className="users-icon-btn danger"
                  title="Eliminar"
                  onClick={() => setConfirmDelete(u)}
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
              {u.role === 'user' && (
                <div className="users-perms-group users-perms-row">
                  {TAB_OPTIONS.map(t => (
                    <label key={t.id} className="users-perm-chip">
                      <input
                        type="checkbox"
                        checked={u.permissions.includes(t.id)}
                        onChange={() => togglePermission(u, t.id)}
                      />
                      <i className={`fa-solid ${t.icon}`} /> {t.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar usuario"
          message={`¿Seguro que quieres eliminar a "${confirmDelete.username}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {resetTarget && (
        <div className="modal-overlay" onClick={() => setResetTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Restablecer contraseña</div>
            <div className="modal-sub">Nueva contraseña para <strong>{resetTarget.username}</strong></div>
            <input
              className="modal-input"
              type="password"
              placeholder="Nueva contraseña (mín. 6)"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleResetPassword() }}
              autoFocus
              autoComplete="new-password"
            />
            <div className="modal-actions">
              <button className="modal-btn secondary" onClick={() => setResetTarget(null)} disabled={resetLoading}>
                Cancelar
              </button>
              <button
                className="modal-btn primary"
                onClick={handleResetPassword}
                disabled={resetLoading || resetPassword.length < 6}
              >
                {resetLoading ? 'Guardando…' : 'Restablecer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
