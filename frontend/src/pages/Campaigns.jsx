import React, { useState, useEffect } from 'react'
import { Send, Eye, MessageSquare, Clock, CheckCircle } from 'lucide-react'
import { toast } from 'react-toastify'

const Campaigns = ({ onNavigate }) => {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns')
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data)
      }
    } catch (error) {
      toast.error('Error fetching campaigns')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft': return <span className="badge badge-warning">Draft</span>
      case 'sending': return <span className="badge badge-info">Sending</span>
      case 'completed': return <span className="badge badge-success">Completed</span>
      default: return <span className="badge badge-info">{status}</span>
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft': return <Clock size={16} />
      case 'sending': return <Send size={16} />
      case 'completed': return <CheckCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loader"></div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Campaigns</h1>
        <p>View and manage all your email campaigns</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            No campaigns yet. Create your first campaign to get started!
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('create-campaign')}>
            <Send size={18} />
            Create Campaign
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigate('campaign-detail', campaign.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{campaign.campaign_name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Created {new Date(campaign.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getStatusIcon(campaign.status)}
                  {getStatusBadge(campaign.status)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Total Leads</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{campaign.total_leads}</p>
                </div>
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <Send size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />Sent
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{campaign.sent_count}</p>
                </div>
                <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <Eye size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />Opened
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{campaign.opened_count}</p>
                </div>
                <div style={{ borderLeft: '3px solid var(--success)', paddingLeft: '1rem' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <MessageSquare size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />Replies
                  </p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{campaign.replied_count}</p>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={(e) => { e.stopPropagation(); onNavigate('campaign-detail', campaign.id) }}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Campaigns