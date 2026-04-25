import React, { useState, useEffect } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './App.css'
import Navbar from './components/Navbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Inboxes from './pages/Inboxes.jsx'
import CreateCampaign from './pages/CreateCampaign.jsx'
import Campaigns from './pages/Campaigns.jsx'
import CampaignDetail from './pages/CampaignDetail.jsx'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [selectedCampaignId, setSelectedCampaignId] = useState(null)
  const [inboxes, setInboxes] = useState([])

  useEffect(() => {
    fetchInboxes()
    checkDueFollowups()
  }, [])

  const checkDueFollowups = async () => {
    try {
      const res = await fetch('/api/followups/check-due', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.due_count > 0) {
          console.log(`Follow-up check: ${data.due_count} due, queued for sending`)
        }
      }
    } catch (e) {
      console.log('Follow-up check skipped:', e.message)
    }
  }

  const fetchInboxes = async () => {
    try {
      const response = await fetch('/api/inboxes')
      if (response.ok) {
        const data = await response.json()
        setInboxes(data)
      }
    } catch (error) {
      console.error('Error fetching inboxes:', error)
    }
  }

  const handleNavigate = (page, campaignId = null) => {
    setCurrentPage(page)
    if (campaignId) {
      setSelectedCampaignId(campaignId)
    }
  }

  const handleInboxAdded = () => {
    fetchInboxes()
  }

  return (
    <div className="app">
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="app-main">
        {currentPage === 'dashboard' && (
          <Dashboard onNavigate={handleNavigate} inboxes={inboxes} />
        )}
        {currentPage === 'inboxes' && (
          <Inboxes inboxes={inboxes} onInboxAdded={handleInboxAdded} />
        )}
        {currentPage === 'create-campaign' && (
          <CreateCampaign inboxes={inboxes} onNavigate={handleNavigate} />
        )}
        {currentPage === 'campaigns' && (
          <Campaigns onNavigate={handleNavigate} />
        )}
        {currentPage === 'campaign-detail' && selectedCampaignId && (
          <CampaignDetail campaignId={selectedCampaignId} onNavigate={handleNavigate} />
        )}
      </main>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  )
}

export default App