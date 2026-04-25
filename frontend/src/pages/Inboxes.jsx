import React, { useState } from 'react'
import { Mail, Plus, Trash2, Check } from 'lucide-react'
import { toast } from 'react-toastify'

const Inboxes = ({ inboxes, onInboxAdded }) => {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    inbox_name: '',
    email_address: '',
    app_password: '',
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Inbox added successfully!')
        setFormData({ inbox_name: '', email_address: '', app_password: '' })
        setShowForm(false)
        onInboxAdded()
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Failed to add inbox')
      }
    } catch (error) {
      toast.error('Error adding inbox')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Email Inboxes</h1>
        <p>Manage your connected Gmail accounts for sending campaigns</p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add New Inbox'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Add Gmail Inbox</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Inbox Name</label>
              <input
                type="text"
                className="form-input"
                name="inbox_name"
                placeholder="e.g., Sales Inbox"
                value={formData.inbox_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Gmail Address</label>
              <input
                type="email"
                className="form-input"
                name="email_address"
                placeholder="your-email@gmail.com"
                value={formData.email_address}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">App Password</label>
              <input
                type="password"
                className="form-input"
                name="app_password"
                placeholder="16-character app password"
                value={formData.app_password}
                onChange={handleInputChange}
                required
              />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Generate at: <strong>myaccount.google.com/apppasswords</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Connecting...' : 'Add Inbox'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Connected Inboxes ({inboxes.length})</h3>
        </div>

        {inboxes.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No inboxes connected yet. Add one to get started!
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Inbox Name</th>
                  <th>Email Address</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inboxes.map((inbox) => (
                  <tr key={inbox.id}>
                    <td>{inbox.inbox_name}</td>
                    <td>{inbox.email_address}</td>
                    <td>
                      <span className="badge badge-success">
                        <Check size={12} style={{ marginRight: '0.25rem' }} />
                        Active
                      </span>
                    </td>
                    <td>{new Date(inbox.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '0.5rem 1rem' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>How to Get Gmail App Password</h3>
        <ol style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>Go to <strong>myaccount.google.com</strong></li>
          <li>Click <strong>Security</strong> in the left menu</li>
          <li>Enable <strong>2-Step Verification</strong> if not already enabled</li>
          <li>Search for <strong>"App passwords"</strong></li>
          <li>Select <strong>Mail</strong> and <strong>Windows Computer</strong></li>
          <li>Copy the 16-character password and paste it above</li>
        </ol>
      </div>
    </div>
  )
}

export default Inboxes
