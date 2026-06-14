import { FormEvent, useEffect, useState } from 'react';

import { createUser, getUsers, setUserActiveState } from '../api/userApi';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { User, UserRole } from '../types/auth';

const Users = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusUser, setStatusUser] = useState<User | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const nextUsers = await getUsers();
      setUsers(nextUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await createUser({ name, email, role });
      setName('');
      setEmail('');
      setRole('member');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (user: User) => {
    setError('');

    try {
      await setUserActiveState(user.id, user.status !== 'active');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  return (
    <section>
      <PageHeader title="Users" eyebrow="Settings" description="Manage internal users, roles, and access status." />

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isAdmin ? (
        <form
          onSubmit={handleCreateUser}
          className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_1fr_160px_auto]"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              placeholder="John Doe"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              placeholder="john@conektads.com"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="self-end rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? 'Adding...' : 'Add User'}
          </button>
        </form>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">Users</h2>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading users...</p>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  {isAdmin ? <th className="px-5 py-3 font-medium">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">{user.name}</td>
                    <td className="px-5 py-4 text-slate-600">{user.email}</td>
                    <td className="px-5 py-4 capitalize text-slate-600">{user.role}</td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          'rounded-full px-2 py-1 text-xs font-medium',
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {user.status}
                      </span>
                    </td>
                    {isAdmin ? (
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setStatusUser(user)}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {user.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{user.name}</h3>
                    <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{user.status}</span>
                </div>
                <p className="mt-3 text-sm capitalize text-slate-600">Role: <strong className="text-slate-900">{user.role}</strong></p>
                {isAdmin ? <button type="button" onClick={() => setStatusUser(user)} className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">{user.status === 'active' ? 'Deactivate' : 'Activate'}</button> : null}
              </article>
            ))}
          </div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(statusUser)}
        title={statusUser?.status === 'active' ? 'Deactivate user?' : 'Activate user?'}
        description={
          statusUser?.status === 'active'
            ? `${statusUser.name} will lose access to the internal platform.`
            : `${statusUser?.name || 'This user'} will be able to sign in again.`
        }
        confirmText={statusUser?.status === 'active' ? 'Deactivate User' : 'Activate User'}
        danger={statusUser?.status === 'active'}
        onClose={() => setStatusUser(null)}
        onConfirm={() => {
          if (!statusUser) return;
          void handleStatusChange(statusUser).finally(() => setStatusUser(null));
        }}
      />
    </section>
  );
};

export default Users;
