import React, { useState } from 'react'
import { Upload, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'react-toastify'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const MAX_VARIATIONS = 4
const MAX_FOLLOWUPS = 5
const VARS_HINT = '{{first_name}}, {{last_name}}, {{company}}, {{email}}, {{job_title}}, {{custom_field_1}}'

const REQUIRED_FIELDS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'company', label: 'Company', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'job_title', label: 'Job Title', required: false },
  { key: 'custom_field_1', label: 'Custom Field 1', required: false },
  { key: 'custom_field_2', label: 'Custom Field 2', required: false },
  { key: 'custom_field_3', label: 'Custom Field 3', required: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function autoDetect(headers) {
  const a = {
    first_name: ['first_name', 'firstname', 'first name', 'fname'],
    last_name: ['last_name', 'lastname', 'last name', 'lname', 'surname'],
    company: ['company', 'company_name', 'organization', 'org', 'business'],
    email: ['email', 'email_address', 'emailaddress', 'e-mail', 'mail'],
    job_title: ['job_title', 'jobtitle', 'title', 'position', 'role'],
    custom_field_1: ['custom_field_1', 'custom1', 'cf1', 'extra1'],
    custom_field_2: ['custom_field_2', 'custom2', 'cf2', 'extra2'],
    custom_field_3: ['custom_field_3', 'custom3', 'cf3', 'extra3'],
  }
  const m = {}
  REQUIRED_FIELDS.forEach(({ key }) => {
    m[key] = headers.find(h => (a[key] || [key]).includes(h.toLowerCase().trim())) || ''
  })
  return m
}

const emptyVariation = () => ({ subject: '', body: '' })
const emptyFollowUp = () => ({ send_after_days: 3, variations: [{ body: '' }], activeVar: 0, open: true })

// ─────────────────────────────────────────────────────────────────────────────
// DOTTED THREAD CONNECTOR
// ─────────────────────────────────────────────────────────────────────────────
const ThreadConnector = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0 0 0 28px' }}>
    <div style={{ width: '2px', height: '24px', background: 'repeating-linear-gradient(to bottom,var(--primary) 0,var(--primary) 5px,transparent 5px,transparent 10px)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <div style={{ width: '16px', height: '2px', background: 'repeating-linear-gradient(to right,var(--primary) 0,var(--primary) 5px,transparent 5px,transparent 10px)' }} />
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', opacity: 0.7 }} />
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// VARIATION TABS (reusable for both template and follow-up)
// ─────────────────────────────────────────────────────────────────────────────
const VariationTabs = ({ variations, activeVar, totalLeads, onSelect, onAdd, onRemove }) => (
  <div style={{ display: 'flex', gap: '6px', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
    {variations.map((_, vi) => {
      const perVar = totalLeads > 0
        ? Math.floor(totalLeads / variations.length) + (vi < totalLeads % variations.length ? 1 : 0)
        : null
      return (
        <div key={vi} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => onSelect(vi)}
            style={{
              padding: '5px 14px', borderRadius: '6px', fontSize: '12px',
              fontWeight: activeVar === vi ? 700 : 400,
              background: activeVar === vi ? 'var(--accent)' : 'var(--bg-surface-3)',
              color: activeVar === vi ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (activeVar === vi ? 'var(--primary)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Variation {vi + 1}
            {perVar !== null && (
              <span style={{ marginLeft: '5px', opacity: 0.7, fontSize: '10px' }}>
                (~{perVar} leads)
              </span>
            )}
          </button>
          {variations.length > 1 && (
            <button onClick={() => onRemove(vi)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0 2px', fontSize: '14px', lineHeight: 1 }}>
              ×
            </button>
          )}
        </div>
      )
    })}
    {variations.length < MAX_VARIATIONS && (
      <button onClick={onAdd}
        style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', background: 'none', border: '1px dashed var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <Plus size={11} /> Add Variation
      </button>
    )}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP CARD
// ─────────────────────────────────────────────────────────────────────────────
const FollowUpCard = ({ fu, fuIdx, originalSubject, totalLeads, onChange, onRemove }) => {
  const activeVar = fu.activeVar ?? 0

  const updateVar = (vi, val) => {
    const vars = [...fu.variations]
    vars[vi] = { ...vars[vi], body: val }
    onChange({ ...fu, variations: vars })
  }
  const addVar = () => {
    if (fu.variations.length >= MAX_VARIATIONS) { toast.warning(`Max ${MAX_VARIATIONS} variations`); return }
    onChange({ ...fu, variations: [...fu.variations, { body: '' }], activeVar: fu.variations.length })
  }
  const removeVar = (vi) => {
    if (fu.variations.length === 1) { toast.warning('At least one variation required'); return }
    onChange({ ...fu, variations: fu.variations.filter((_, i) => i !== vi), activeVar: 0 })
  }

  const perVar = totalLeads > 0 && fu.variations.length > 0
    ? null  // follow-up target count not known until send time — skip preview
    : null

  return (
    <div>
      <ThreadConnector />
      <div style={{
        border: '1px solid var(--border)', borderLeft: '3px solid rgba(217,119,87,0.40)',
        borderRadius: '10px', background: 'var(--bg-surface)', padding: '1.25rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
            }}>{fuIdx + 1}</div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Follow-up #{fuIdx + 1}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Re: {originalSubject || '(original subject)'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Send after</span>
              <input
                type="number" min="1" max="365"
                value={fu.send_after_days}
                onChange={e => onChange({ ...fu, send_after_days: Math.max(1, parseInt(e.target.value) || 1) })}
                style={{ width: '56px', padding: '4px 6px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.85rem', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>days</span>
            </div>
            <button onClick={() => onChange({ ...fu, open: !fu.open })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              {fu.open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button onClick={onRemove}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--danger)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>

        {fu.open && (
          <>
            {/* Locked subject */}
            <div style={{ background: 'var(--bg-surface-3)', borderRadius: '6px', padding: '8px 12px', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>Subject (auto):</span> Re: {originalSubject || '(original subject)'}
              <span style={{ marginLeft: '8px', fontSize: '11px', background: 'rgba(217,119,87,0.12)', color: 'var(--accent)', padding: '1px 6px', borderRadius: '4px' }}>locked</span>
            </div>

            <VariationTabs
              variations={fu.variations}
              activeVar={activeVar}
              totalLeads={0}
              onSelect={vi => onChange({ ...fu, activeVar: vi })}
              onAdd={addVar}
              onRemove={removeVar}
            />

            <textarea
              className="form-textarea"
              style={{ minHeight: '100px', fontSize: '0.88rem' }}
              placeholder={`Hi {{first_name}},\n\nJust following up on my previous email...`}
              value={fu.variations[activeVar]?.body || ''}
              onChange={e => updateVar(activeVar, e.target.value)}
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>{VARS_HINT}</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const CreateCampaign = ({ inboxes, onNavigate }) => {
  const [step, setStep] = useState(1)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRawData, setCsvRawData] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [leads, setLeads] = useState([])
  const [campaignData, setCampaignData] = useState({
    campaign_name: '',
    inbox_id: inboxes.length > 0 ? String(inboxes[0].id) : '',
  })

  // Single template state
  const [variations, setVariations] = useState([emptyVariation()])
  const [activeVar, setActiveVar] = useState(0)
  const [followups, setFollowups] = useState([])
  const [loading, setLoading] = useState(false)

  // ── Step 1: upload CSV ────────────────────────────────────────────────────
  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const csv = ev.target.result
      const lines = csv.split('\n').filter(l => l.trim())
      if (lines.length < 2) { toast.error('CSV is empty.'); return }
      const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.replace(/^"|"$/g, '').trim())
      const data = []
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',')
        const row = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] ? vals[idx].replace(/^"|"$/g, '').trim() : '' })
        data.push(row)
      }
      setCsvHeaders(headers)
      setCsvRawData(data)
      setColumnMapping(autoDetect(headers))
      toast.success(`Loaded ${data.length} rows`)
      setStep(2)
    }
    reader.readAsText(file)
  }

  // ── Step 2: apply mapping ─────────────────────────────────────────────────
  const applyMapping = () => {
    const missing = REQUIRED_FIELDS.filter(f => f.required && !columnMapping[f.key]).map(f => f.label)
    if (missing.length) { toast.error(`Map required: ${missing.join(', ')}`); return }
    const mapped = csvRawData.map(row => {
      const l = {}
      REQUIRED_FIELDS.forEach(({ key }) => { l[key] = columnMapping[key] ? (row[columnMapping[key]] || '') : '' })
      return l
    })
    const invalid = mapped.filter(l => !l.email?.includes('@'))
    if (invalid.length) toast.warning(`${invalid.length} rows skipped — invalid email`)
    const valid = mapped.filter(l => l.email?.includes('@'))
    if (!valid.length) { toast.error('No valid emails found'); return }
    setLeads(valid)
    toast.success(`${valid.length} valid leads ready`)
    setStep(3)
  }

  // ── Variation helpers ─────────────────────────────────────────────────────
  const updateVariation = (vi, field, val) => {
    const v = [...variations]; v[vi] = { ...v[vi], [field]: val }; setVariations(v)
  }
  const addVariation = () => {
    if (variations.length >= MAX_VARIATIONS) { toast.warning(`Max ${MAX_VARIATIONS} variations`); return }
    setVariations([...variations, emptyVariation()])
    setActiveVar(variations.length)
  }
  const removeVariation = (vi) => {
    if (variations.length === 1) { toast.warning('At least one variation required'); return }
    setVariations(variations.filter((_, i) => i !== vi))
    setActiveVar(0)
  }

  // ── Follow-up helpers ─────────────────────────────────────────────────────
  const addFollowUp = () => {
    if (followups.length >= MAX_FOLLOWUPS) { toast.warning(`Max ${MAX_FOLLOWUPS} follow-ups`); return }
    setFollowups([...followups, emptyFollowUp()])
  }
  const updateFollowUp = (fi, updated) => {
    const f = [...followups]; f[fi] = updated; setFollowups(f)
  }
  const removeFollowUp = (fi) => setFollowups(followups.filter((_, i) => i !== fi))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!campaignData.inbox_id) { toast.error('Select an inbox'); return }
    if (!campaignData.campaign_name) { toast.error('Enter a campaign name'); return }
    if (!leads.length) { toast.error('No leads loaded'); return }

    const filledVars = variations.filter(v => v.subject.trim() && v.body.trim())
    if (!filledVars.length) { toast.error('Fill in at least one variation (subject + body)'); return }

    for (let fi = 0; fi < followups.length; fi++) {
      const fu = followups[fi]
      if (!fu.send_after_days || fu.send_after_days < 1) {
        toast.error(`Follow-up #${fi + 1}: set a valid number of days`); return
      }
      const filledFuVars = fu.variations.filter(v => v.body.trim())
      if (!filledFuVars.length) {
        toast.error(`Follow-up #${fi + 1}: fill in at least one variation body`); return
      }
    }

    const payload = {
      campaign_name: campaignData.campaign_name,
      inbox_id: parseInt(campaignData.inbox_id),
      leads,
      templates: [{
        variations: filledVars,
        followups: followups.map(fu => ({
          send_after_days: fu.send_after_days,
          variations: fu.variations.filter(v => v.body.trim()).map(v => ({ body: v.body })),
        })).filter(fu => fu.variations.length > 0),
      }],
    }

    setLoading(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Campaign created!')
        onNavigate('campaigns')
      } else {
        const err = await res.json()
        toast.error(typeof err.detail === 'string' ? err.detail : 'Failed to create campaign')
      }
    } catch (e) { toast.error('Network error'); console.error(e) }
    finally { setLoading(false) }
  }

  const stepLabels = ['Upload CSV', 'Map Columns', 'Template & Launch']
  const firstSubject = variations[0]?.subject || ''

  // Per-variation lead count for display
  const perVarCount = leads.length > 0
    ? Math.floor(leads.length / variations.length)
    : 0
  const remainder = leads.length % variations.length

  return (
    <div className="page">
      <div className="page-header">
        <h1>Create Campaign</h1>
        <p>Set up your email template, variations, and follow-ups</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
        {stepLabels.map((label, i) => {
          const s = i + 1; const isActive = step === s; const isDone = step > s
          return (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div
                  onClick={() => isDone && setStep(s)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: isDone || isActive ? 'var(--accent)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '14px',
                    color: isDone || isActive ? '#fff' : 'var(--text-secondary)',
                    cursor: isDone ? 'pointer' : 'default',
                    border: isActive
                      ? '2px solid var(--accent)'
                      : isDone
                        ? '2px solid var(--accent)'
                        : '2px solid var(--border-strong)',
                    boxSizing: 'border-box',
                    boxShadow: isActive ? '0 0 0 3px rgba(217,119,87,0.15)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {isDone ? '✓' : s}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: isActive ? 'var(--accent)' : isDone ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: 'nowrap'
                }}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div style={{
                  width: '80px', height: '2px',
                  background: step > s
                    ? 'var(--accent)'
                    : 'var(--border)',
                  margin: '0 8px',
                  marginBottom: '22px',
                  borderRadius: '2px',
                  transition: 'background 0.3s',
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* ── STEP 1: Upload CSV ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Step 1: Upload Leads (CSV)</h3>
          <div
            style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '3rem', textAlign: 'center', marginBottom: '1.5rem', transition: 'all 0.2s' }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            onDrop={e => {
              e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'
              const f = e.dataTransfer.files[0]
              if (f) handleCSVUpload({ target: { files: [f] } })
            }}
          >
            <Upload size={40} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
            <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Drag and drop your CSV here</p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>or click to select</p>
            <input id="csvInput" type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
            <label htmlFor="csvInput" style={{ cursor: 'pointer' }}>
              <span className="btn btn-secondary">Select CSV</span>
            </label>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Your CSV can have any column names — you will map them in the next step.
          </p>
        </div>
      )}

      {/* ── STEP 2: Map Columns ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>Step 2: Map Your Columns</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Fields marked <span style={{ color: 'var(--danger)' }}>*</span> are required.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {REQUIRED_FIELDS.map(({ key, label, required }) => (
              <div key={key} className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                </label>
                <select
                  className="form-select"
                  value={columnMapping[key] || ''}
                  onChange={e => setColumnMapping({ ...columnMapping, [key]: e.target.value })}
                  style={{ borderColor: required && !columnMapping[key] ? '#f87171' : undefined }}
                >
                  <option value="">— not mapped —</option>
                  {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {csvRawData.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.88rem' }}>Preview — first 3 rows:</p>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      {REQUIRED_FIELDS.map(({ key, label }) => (
                        <th key={key} style={{ fontSize: '0.78rem' }}>
                          {label}
                          {columnMapping[key] && columnMapping[key] !== key && (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> ← {columnMapping[key]}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRawData.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {REQUIRED_FIELDS.map(({ key }) => {
                          const v = columnMapping[key] ? row[columnMapping[key]] : ''
                          return <td key={key} style={{ color: !v ? '#f87171' : undefined, fontSize: '0.82rem' }}>{v || '—'}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={applyMapping}>Confirm & Continue</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Template & Launch ──────────────────────────────────────── */}
      {step === 3 && (
        <div>
          {/* Campaign settings */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>Step 3: Campaign Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: leads.length > 0 ? '1rem' : 0 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Campaign Name</label>
                <input type="text" className="form-input" placeholder="e.g., Q2 Outreach"
                  value={campaignData.campaign_name}
                  onChange={e => setCampaignData({ ...campaignData, campaign_name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Inbox</label>
                <select className="form-select" value={campaignData.inbox_id}
                  onChange={e => setCampaignData({ ...campaignData, inbox_id: e.target.value })}>
                  <option value="">Select inbox</option>
                  {inboxes.map(i => (
                    <option key={i.id} value={i.id}>{i.inbox_name} ({i.email_address})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Variation distribution summary */}
            {leads.length > 0 && variations.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', padding: '0.875rem 1rem', fontSize: '0.85rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  {leads.length} leads across {variations.length} variation{variations.length > 1 ? 's' : ''}:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {variations.map((_, vi) => {
                    const count = perVarCount + (vi < remainder ? 1 : 0)
                    const from = vi * perVarCount + Math.min(vi, remainder) + 1
                    const to = from + count - 1
                    return (
                      <span key={vi} style={{ background: 'var(--bg-surface-3)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        Variation {vi + 1}: leads {from}–{to} ({count})
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Template card ── */}
          <div className="card" style={{ borderLeft: '3px solid var(--primary)', marginBottom: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#fff', flexShrink: 0 }}>
                ✉
              </div>
              <h4 style={{ margin: 0 }}>Email Template</h4>
            </div>

            <VariationTabs
              variations={variations}
              activeVar={activeVar}
              totalLeads={leads.length}
              onSelect={vi => setActiveVar(vi)}
              onAdd={addVariation}
              onRemove={removeVariation}
            />

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.82rem' }}>
                Subject — Variation {activeVar + 1}
              </label>
              <input type="text" className="form-input"
                placeholder={`Hi {{first_name}}, reaching out about... (Variation ${activeVar + 1})`}
                value={variations[activeVar]?.subject || ''}
                onChange={e => updateVariation(activeVar, 'subject', e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.82rem' }}>
                Body — Variation {activeVar + 1}
              </label>
              <textarea className="form-textarea"
                placeholder={`Hi {{first_name}},\n\nI came across {{company}} and thought...`}
                value={variations[activeVar]?.body || ''}
                onChange={e => updateVariation(activeVar, 'body', e.target.value)} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>{VARS_HINT}</p>

            {/* Add follow-up button */}
            {followups.length < MAX_FOLLOWUPS && (
              <button onClick={addFollowUp}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(217,119,87,0.07)', border: '1px dashed rgba(217,119,87,0.35)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: 'var(--accent)', fontSize: '13px', fontWeight: 500 }}>
                <Plus size={14} /> Add Follow-up
              </button>
            )}
          </div>

          {/* ── Follow-up chain ── */}
          {followups.map((fu, fi) => (
            <FollowUpCard
              key={fi}
              fu={fu}
              fuIdx={fi}
              originalSubject={firstSubject}
              totalLeads={leads.length}
              onChange={updated => updateFollowUp(fi, updated)}
              onRemove={() => removeFollowUp(fi)}
            />
          ))}

          {/* ── Launch bar ── */}
          <div className="card" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{leads.length}</span> leads &nbsp;·&nbsp;
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{variations.filter(v => v.subject.trim() && v.body.trim()).length}</span> variation{variations.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{followups.length}</span> follow-up{followups.length !== 1 ? 's' : ''} scheduled
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={loading}
                style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                {loading ? 'Creating...' : 'Create & Launch Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateCampaign