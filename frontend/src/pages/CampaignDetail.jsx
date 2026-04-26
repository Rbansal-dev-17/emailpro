import React, { useState, useEffect } from 'react'
import { ArrowLeft, Send, RefreshCw, Eye, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'react-toastify'

// ── Follow-up Row (expandable) ────────────────────────────────────────────────
const FollowUpRow = ({ fu, campaignId }) => {
  const [expanded, setExpanded] = useState(false)
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (expanded) { setExpanded(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/followups/${fu.id}/emails`)
      if (res.ok) setEmails(await res.json())
    } catch { toast.error('Could not load follow-up emails') }
    finally { setLoading(false); setExpanded(true) }
  }

  const statusBadge = (s) => {
    if (s === 'completed') return <span className="badge badge-success">Completed</span>
    if (s === 'sending') return <span className="badge badge-info">Sending</span>
    if (s === 'scheduled') return <span className="badge badge-info">Scheduled</span>
    if (s === 'waiting') return <span className="badge badge-warning">Waiting</span>
    return <span className="badge badge-warning">{s}</span>
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: '3px solid rgba(217,119,87,0.40)', borderRadius: '10px', marginBottom: '0.75rem', overflow: 'hidden' }}>
      <div
        onClick={toggle}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-surface)', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <MessageSquare size={15} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Follow-up #{fu.id}</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            after {fu.send_after_days} day{fu.send_after_days !== 1 ? 's' : ''}
          </span>
          {fu.scheduled_send_at && (
            <span style={{ fontSize: '11px', background: 'var(--bg-surface-3)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
              {new Date(fu.scheduled_send_at).toLocaleDateString()} {new Date(fu.scheduled_send_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{fu.sent_count} sent</span>
          {statusBadge(fu.status)}
          {loading
            ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0.75rem 1rem' }}>
          {/* Variation bodies */}
          {fu.variations && fu.variations.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                {fu.variations.length} variation{fu.variations.length > 1 ? 's' : ''}:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {fu.variations.map(v => (
                  <div key={v.variation_index} style={{ background: 'var(--bg-surface-3)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                    <strong>Var {v.variation_index + 1}:</strong> {v.body?.slice(0, 80)}{v.body?.length > 80 ? '…' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {emails.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {fu.status === 'waiting' ? 'Will be scheduled once campaign completes.' : 'No emails sent yet.'}
            </p>
          ) : (
            <table className="table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Variation</th>
                  <th>Status</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(e => (
                  <tr key={e.id}>
                    <td>{e.recipient_email}</td>
                    <td>
                      <span style={{ background: 'rgba(217,119,87,0.12)', color: 'var(--accent)', borderRadius: '4px', padding: '2px 7px', fontSize: '11px' }}>
                        V{(e.followup_variation_index ?? 0) + 1}
                      </span>
                    </td>
                    <td>
                      {e.status === 'sent'
                        ? <span className="badge badge-success">Sent</span>
                        : e.status === 'failed'
                          ? <span className="badge badge-danger">Failed</span>
                          : <span className="badge badge-warning">Pending</span>}
                    </td>
                    <td>{e.sent_at ? new Date(e.sent_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const CampaignDetail = ({ campaignId, onNavigate }) => {
  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetchCampaign()
    checkRepliesAndBounces()
    const iv = setInterval(fetchCampaign, 4000)
    return () => clearInterval(iv)
  }, [campaignId])

  const checkRepliesAndBounces = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/check-replies`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        const total = (data.replies || 0) + (data.hard_bounces || 0) + (data.soft_bounces || 0)
        if (total > 0) {
          toast.info(`Synced: ${data.replies} replies, ${data.hard_bounces} hard bounces, ${data.soft_bounces} soft bounces detected`)
          fetchCampaign()
        }
      }
    } catch (e) {
      console.log('Reply/bounce check skipped:', e.message)
    }
  }

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`)
      if (res.ok) setCampaign(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) { toast.success(data.message); fetchCampaign() }
      else toast.error(data.detail || 'Failed to send')
    } catch { toast.error('Error sending campaign') }
    finally { setSending(false) }
  }

  if (loading || !campaign) return <div className="page"><div className="loader"></div></div>

  const templates = campaign.email_templates || []
  const tpl = templates[0] || {}
  const tplVariations = tpl.variations || []
  const followups = campaign.followups || []
  const emails = campaign.emails || []

  const openRate = campaign.sent_count > 0
    ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(1) : 0

  // Build set of replied email addresses for badge display
  const repliedEmails = new Set(
    emails
      .filter(e => e.has_reply)
      .map(e => e.recipient_email?.toLowerCase())
  )
  const hardBounces = emails.filter(e => e.is_bounced && e.bounce_type === 'hard').length
  const softBounces = emails.filter(e => e.is_bounced && e.bounce_type === 'soft').length

  // Per-variation stats from sent emails
  const varStats = tplVariations.map((v, vi) => {
    const varEmails = emails.filter(e => e.variation_index === vi)
    return {
      vi,
      subject: v.subject,
      sent: varEmails.filter(e => e.status === 'sent').length,
      opened: varEmails.filter(e => e.is_opened).length,
    }
  })

  return (
    <div className="page">
      <button className="btn btn-secondary" onClick={() => onNavigate('campaigns')} style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={18} /> Back to Campaigns
      </button>

      <div className="page-header">
        <h1>{campaign.campaign_name}</h1>
        <p>Campaign ID: {campaign.id}</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        {[
          {
            label: 'Status', value: campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1),
            color: campaign.status === 'draft' ? 'var(--warning)' : campaign.status === 'sending' ? 'var(--info)' : 'var(--success)'
          },
          { label: 'Total Leads', value: campaign.total_leads },
          { label: 'Emails Sent', value: campaign.sent_count },
          { label: 'Opens', value: `${campaign.opened_count} (${openRate}%)` },
          { label: 'Replies', value: campaign.replied_count },
          { label: 'Hard Bounces', value: hardBounces, color: hardBounces > 0 ? '#f87171' : undefined },
          { label: 'Soft Bounces', value: softBounces, color: softBounces > 0 ? '#fbbf24' : undefined },
          { label: 'Follow-ups', value: followups.length },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Send button */}
      {campaign.status === 'draft' && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Ready to launch? Click below to start sending emails.
          </p>
          <button className="btn btn-success" onClick={handleSend} disabled={sending}
            style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Send size={18} /> {sending ? 'Sending...' : 'Send Campaign'}
          </button>
        </div>
      )}

      {/* Variation breakdown */}
      {tplVariations.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', borderLeft: '3px solid var(--accent)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Email Template — {tplVariations.length} Variation{tplVariations.length > 1 ? 's' : ''}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {varStats.map(v => (
              <div key={v.vi} style={{ background: 'var(--bg-surface)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {v.vi + 1}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Variation {v.vi + 1}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', wordBreak: 'break-word' }}>
                  {v.subject || <em>No subject</em>}
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  <span><strong>{v.sent}</strong> sent</span>
                  <span><strong>{v.opened}</strong> opened</span>
                  <span><strong>{v.sent > 0 ? ((v.opened / v.sent) * 100).toFixed(0) : 0}%</strong> rate</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up chain */}
      {followups.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Follow-up Chain ({followups.length})</h3>
          {followups.map(fu => (
            <FollowUpRow key={fu.id} fu={fu} campaignId={campaign.id} />
          ))}
        </div>
      )}

      {/* All emails table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">All Sent Emails</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={checkRepliesAndBounces}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MessageSquare size={14} /> Sync Replies & Bounces
            </button>
            <button className="btn btn-secondary" onClick={fetchCampaign} style={{ padding: '0.5rem 1rem' }}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>

        {emails.length > 0 ? (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Variation</th>
                  <th>Status</th>
                  <th>Bounce</th>
                  <th><Eye size={13} style={{ display: 'inline', marginRight: 4 }} />Opened</th>
                  <th>Sent At</th>
                </tr>
              </thead>
              <tbody>
                {emails.map(e => (
                  <tr key={e.id} style={{ opacity: e.is_bounced ? 0.6 : 1 }}>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.recipient_email}
                      {repliedEmails.has(e.recipient_email?.toLowerCase()) && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '1px 5px', borderRadius: '3px' }}>replied</span>
                      )}
                    </td>
                    <td>
                      <span style={{ background: 'rgba(217,119,87,0.12)', color: 'var(--accent)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px' }}>
                        V{(e.variation_index ?? 0) + 1}
                      </span>
                    </td>
                    <td>
                      {e.status === 'sent' && <span className="badge badge-success">Sent</span>}
                      {e.status === 'pending' && <span className="badge badge-warning">Pending</span>}
                      {e.status === 'failed' && <span className="badge badge-danger">Failed</span>}
                    </td>
                    <td>
                      {e.is_bounced && e.bounce_type === 'hard' && (
                        <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>Hard</span>
                      )}
                      {e.is_bounced && e.bounce_type === 'soft' && (
                        <span style={{ fontSize: '11px', background: 'rgba(251,191,36,0.15)', color: 'var(--warning)', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>Soft</span>
                      )}
                      {!e.is_bounced && <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>—</span>}
                    </td>
                    <td>
                      {e.is_opened
                        ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Yes ({e.open_count}×)</span>
                        : <span style={{ color: 'var(--text-secondary)' }}>No</span>}
                    </td>
                    <td>{e.sent_at ? new Date(e.sent_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            No emails sent yet
          </p>
        )}
      </div>
    </div>
  )
}

export default CampaignDetail