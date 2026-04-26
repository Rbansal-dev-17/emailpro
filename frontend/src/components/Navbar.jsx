import React from 'react'
import { Mail, BarChart3, Send, Plus, Inbox } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'inboxes', label: 'Inboxes', icon: Inbox },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'create-campaign', label: 'New Campaign', icon: Plus },
]

const Navbar = ({ currentPage, onNavigate }) => {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Brand */}
        <button
          className="navbar-brand"
          onClick={() => onNavigate('dashboard')}
        >
          <Mail size={20} />
          <span>EmailPro</span>
        </button>

        {/* Nav links */}
        <div className="navbar-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${currentPage === id ? 'active' : ''}`}
              onClick={() => onNavigate(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default Navbar