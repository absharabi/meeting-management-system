import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Trash2, Edit3, Plus, LogOut, Sun, Moon,
  Search, CheckCircle2, XCircle, FileSpreadsheet, X
} from 'lucide-react';
import api from '../lib/axios';

type Role = 'SuperAdmin' | 'Admin' | 'Organizer' | 'Participant' | 'Reviewer';

const Role = {
  SuperAdmin: 'SuperAdmin' as Role,
  Admin: 'Admin' as Role,
  Organizer: 'Organizer' as Role,
  Participant: 'Participant' as Role,
  Reviewer: 'Reviewer' as Role,
};

interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  isActive: boolean;
  avatar?: string;
}

interface Props {
  dark: boolean;
  toggleTheme: () => void;
}

export default function Dashboard({ dark, toggleTheme }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: Role.Participant,
    department: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    role: Role.Participant,
    department: '',
    isActive: true,
  });

  useEffect(() => {
    // Auth Check
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      navigate('/', { replace: true });
      return;
    }
    setCurrentUser(JSON.parse(storedUser));
    fetchUsers();
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch users');
      if (err.response?.status === 401) {
        localStorage.clear();
        navigate('/', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setSuccessMsg('User added successfully');
      setAddModalOpen(false);
      setFormData({ name: '', email: '', role: Role.Participant, department: '' });
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add user');
    }
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.put(`/users/${selectedUser._id}`, editFormData);
      setSuccessMsg('User updated successfully');
      setEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      setSuccessMsg('User deleted successfully');
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('file', file);

    try {
      setLoading(true);
      const res = await api.post('/users/bulk', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessMsg(res.data.message || 'Bulk upload complete');
      fetchUsers();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.clear();
      navigate('/', { replace: true });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.department.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && user.isActive) ||
      (statusFilter === 'INACTIVE' && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'DM Sans, sans-serif',
      transition: 'all 0.3s ease',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 20, fontWeight: 900,
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
          }}>M</div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Meeting Directory</h1>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Workspace User Management</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              width: 38, height: 38, borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Current User Info */}
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{currentUser.name}</div>
                <div style={{
                  fontSize: 11,
                  color: currentUser.role === Role.SuperAdmin ? '#10b981' : '#3b82f6',
                  fontWeight: 600
                }}>{currentUser.role}</div>
              </div>
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}
                alt="Profile"
                style={{ width: 40, height: 40, borderRadius: 12, border: '2px solid var(--border)' }}
              />
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10,
              border: '1px solid #f87171',
              background: 'transparent',
              color: '#ef4444',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#ef4444';
            }}
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: 36, maxWidth: 1280, width: '100%', margin: '0 auto' }}>
        {/* Banner Messages */}
        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            borderRadius: 12,
            padding: '12px 20px',
            color: '#10b981',
            fontSize: 14, fontWeight: 500,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <CheckCircle2 size={18} />
            {successMsg}
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: 12,
            padding: '12px 20px',
            color: '#ef4444',
            fontSize: 14, fontWeight: 500,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <XCircle size={18} />
            {error}
          </div>
        )}

        {/* Action Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          marginBottom: 32,
          flexWrap: 'wrap'
        }}>
          {/* Search bar */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 360,
          }}>
            <Search size={18} style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
            <input
              type="text"
              placeholder="Search by name, email or department..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px 12px 42px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {/* Filters & Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="ALL">All Roles</option>
              {Object.values(Role).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontSize: 14,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            {/* Bulk Import */}
            <input
              type="file"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              onChange={handleBulkUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 18px', borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <FileSpreadsheet size={16} color="#10b981" />
              Excel Upload
            </button>

            {/* Add User Button */}
            <button
              onClick={() => setAddModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: 'white',
                border: 'none',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
              }}
            >
              <Plus size={16} />
              Add User
            </button>
          </div>
        </div>

        {/* Directory Listing */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2px solid var(--border)',
                borderTopColor: '#3b82f6',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading user directory...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <Users size={48} style={{ opacity: 0.25, marginBottom: 16 }} />
              <p style={{ fontSize: 16, fontWeight: 600 }}>No users found</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your search criteria or filters</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>USER</th>
                    <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>ROLE</th>
                    <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>DEPARTMENT</th>
                    <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>STATUS</th>
                    <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <img
                            src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}
                            alt={user.name}
                            style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg)' }}
                          />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '18px 24px' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          padding: '4px 10px', borderRadius: 8,
                          background: user.role === Role.SuperAdmin ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                          color: user.role === Role.SuperAdmin ? '#10b981' : '#3b82f6',
                        }}>{user.role}</span>
                      </td>
                      <td style={{ padding: '18px 24px', fontSize: 14, color: 'var(--text)' }}>
                        {user.department || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>}
                      </td>
                      <td style={{ padding: '18px 24px' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          color: user.isActive ? '#10b981' : '#ef4444',
                        }}>
                          {user.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleEditClick(user)}
                            style={{
                              border: 'none', background: 'transparent',
                              color: 'var(--text-muted)', cursor: 'pointer',
                              padding: 6, borderRadius: 6,
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = '#3b82f6';
                              e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(user._id)}
                            style={{
                              border: 'none', background: 'transparent',
                              color: 'var(--text-muted)', cursor: 'pointer',
                              padding: 6, borderRadius: 6,
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = 'var(--text-muted)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add User Modal */}
      {addModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 20
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 32,
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <button
              onClick={() => setAddModalOpen(false)}
              style={{
                position: 'absolute', top: 20, right: 20,
                border: 'none', background: 'transparent',
                color: 'var(--text-muted)', cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Directory User</h2>
            <form onSubmit={handleAddSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none', cursor: 'pointer'
                    }}
                  >
                    {Object.values(Role).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    color: 'white', border: 'none', borderRadius: 10, padding: 12,
                    fontWeight: 600, cursor: 'pointer', marginTop: 10,
                    boxShadow: '0 4px 14px rgba(99,102,241,0.2)'
                  }}
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && selectedUser && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, padding: 20
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: 32,
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
            position: 'relative'
          }}>
            <button
              onClick={() => { setEditModalOpen(false); setSelectedUser(null); }}
              style={{
                position: 'absolute', top: 20, right: 20,
                border: 'none', background: 'transparent',
                color: 'var(--text-muted)', cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Modify User</h2>
            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Role</label>
                  <select
                    value={editFormData.role}
                    onChange={e => setEditFormData({ ...editFormData, role: e.target.value as Role })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none', cursor: 'pointer'
                    }}
                  >
                    {Object.values(Role).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Department</label>
                  <input
                    type="text"
                    value={editFormData.department}
                    onChange={e => setEditFormData({ ...editFormData, department: e.target.value })}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editFormData.isActive}
                    onChange={e => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="isActive" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Account Active</label>
                </div>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    color: 'white', border: 'none', borderRadius: 10, padding: 12,
                    fontWeight: 600, cursor: 'pointer', marginTop: 10,
                    boxShadow: '0 4px 14px rgba(99,102,241,0.2)'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Spinner animation keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
