import React from 'react'
import { Mail, Settings, BarChart3, Send } from 'lucide-react'

const Navbar = ({ currentPage, onNavigate }) => {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <button
          className="navbar-brand"
          onClick={() => onNavigate('dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Mail size={28} />
          <span>EmailPro</span>
        </button>

        <div className="navbar-nav">
          <button
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <BarChart3 size={18} style={{ marginRight: '0.5rem' }} />
            Dashboard
          </button>
          <button
            className={`nav-link ${currentPage === 'inboxes' ? 'active' : ''}`}
            onClick={() => onNavigate('inboxes')}
          >
            <Mail size={18} style={{ marginRight: '0.5rem' }} />
            Inboxes
          </button>
          <button
            className={`nav-link ${currentPage === 'campaigns' ? 'active' : ''}`}
            onClick={() => onNavigate('campaigns')}
          >
            <Send size={18} style={{ marginRight: '0.5rem' }} />
            Campaigns
          </button>
          <button
            className={`nav-link ${currentPage === 'create-campaign' ? 'active' : ''}`}
            onClick={() => onNavigate('create-campaign')}
          >
            <Settings size={18} style={{ marginRight: '0.5rem' }} />
            New Campaign
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
