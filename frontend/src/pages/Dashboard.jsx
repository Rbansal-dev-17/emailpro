import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Mail, Send, Eye, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react'

const Dashboard = ({ onNavigate, inboxes }) => {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const chartData = [
    { name: 'Open Rate', value: analytics?.open_rate || 0 },
    { name: 'Reply Rate', value: analytics?.reply_rate || 0 },
    { name: 'Daily Limit Used', value: analytics?.daily_limit_used || 0 },
  ]

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Monitor your email campaigns and engagement metrics</p>
      </div>

      {loading ? (
        <div className="loader"></div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(217,119,87,0.12)', color: 'var(--accent)' }}>
                <Send size={24} />
              </div>
              <div className="stat-label">Total Campaigns</div>
              <div className="stat-value">{analytics?.total_campaigns || 0}</div>
              <div className="stat-subtext">Campaigns created</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(180,80,60,0.10)', color: '#b4503c' }}>
                <Mail size={24} />
              </div>
              <div className="stat-label">Emails Sent</div>
              <div className="stat-value">{analytics?.total_emails_sent || 0}</div>
              <div className="stat-subtext">Total emails sent</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                <Eye size={24} />
              </div>
              <div className="stat-label">Opens</div>
              <div className="stat-value">{analytics?.total_opens || 0}</div>
              <div className="stat-subtext">{analytics?.open_rate || 0}% open rate</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                <MessageSquare size={24} />
              </div>
              <div className="stat-label">Replies</div>
              <div className="stat-value">{analytics?.total_replies || 0}</div>
              <div className="stat-subtext">{analytics?.reply_rate || 0}% reply rate</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)' }}>
                <TrendingUp size={24} />
              </div>
              <div className="stat-label">Daily Limit</div>
              <div className="stat-value">{analytics?.daily_limit_remaining || 0}</div>
              <div className="stat-subtext">{analytics?.daily_limit_used || 0}/20 used</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent)' }}>
                <AlertCircle size={24} />
              </div>
              <div className="stat-label">Weekly Limit</div>
              <div className="stat-value">{analytics?.weekly_limit_remaining || 0}</div>
              <div className="stat-subtext">{analytics?.weekly_limit_used || 0}/100 used</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Performance Overview</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Quick Actions</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onNavigate('create-campaign')}
                  style={{ width: '100%' }}
                >
                  <Send size={18} />
                  Create New Campaign
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => onNavigate('campaigns')}
                  style={{ width: '100%' }}
                >
                  <Mail size={18} />
                  View All Campaigns
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => onNavigate('inboxes')}
                  style={{ width: '100%' }}
                >
                  <Mail size={18} />
                  Manage Inboxes ({inboxes.length})
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Stats</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Last 7 Days</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{analytics?.last_7_days_sent || 0}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Emails sent</p>
              </div>
              <div style={{ borderLeft: '3px solid var(--text-secondary)', paddingLeft: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Average Open Rate</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{(analytics?.open_rate || 0).toFixed(1)}%</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Across all campaigns</p>
              </div>
              <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Average Reply Rate</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{(analytics?.reply_rate || 0).toFixed(1)}%</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Across all campaigns</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard