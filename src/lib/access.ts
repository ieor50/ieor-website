import type { Access, FieldAccess } from 'payload'

type WithRole = { role?: string | null } | null | undefined

export const isAdmin: Access = ({ req }) => (req.user as WithRole)?.role === 'admin'

export const isEditorOrAdmin: Access = ({ req }) => {
  const role = (req.user as WithRole)?.role
  return role === 'admin' || role === 'editor'
}

export const isAdminField: FieldAccess = ({ req }) => (req.user as WithRole)?.role === 'admin'

export const isSelfOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if ((req.user as WithRole)?.role === 'admin') return true
  return { id: { equals: req.user.id } }
}

// Public read, staff write. Shared by every content collection.
export const contentAccess = {
  read: () => true,
  create: isEditorOrAdmin,
  update: isEditorOrAdmin,
  delete: isEditorOrAdmin,
}
