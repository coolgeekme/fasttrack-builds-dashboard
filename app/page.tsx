'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Rocket, Send, Globe, Phone, Star, MapPin, Loader2, CheckCircle, ExternalLink, RefreshCw, GitBranch, ArrowRight, AlertTriangle, X, Info, Palette } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

interface Business {
  name: string
  phone: string | null
  address: string | null
  rating: number | null
  reviews: number | null
  services: string[]
  has_website: boolean
  place_id?: string | null
  website_status?: 'none' | 'outdated'
  website_domain?: string | null
  website_age_years?: number | null
}

interface PipelineLead {
  id: number
  name: string
  phone: string | null
  address: string | null
  rating: number | null
  reviews: number | null
  status: string
  repo_url: string | null
  preview_url: string | null
  created_at: string
  palette: string | null
  layout: string | null
  variation_id: string | null
  website_status?: 'none' | 'outdated'
  website_domain?: string | null
  website_age_years?: number | null
}

interface GenerateResult {
  status: string
  repo: string
  repo_url: string
  message: string
  palette?: string
  layout_type?: string
  variation_id?: string
}

interface DeployResult {
  status: string
  url: string
  deployment_state: string
  message: string
}

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

// Strips any (possibly repeated) leading http(s):// before re-adding exactly one,
// so a backend value that's already prefixed never turns into "https://https://..."
function ensureHttps(url: string | null | undefined): string {
  if (!url) return ''
  const stripped = url.trim().replace(/^(?:https?:\/\/)+/i, '')
  return stripped ? `https://${stripped}` : ''
}

// ─── Toast System ────────────────────────────────────────────────────────────

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl animate-slide-in ${
            toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' :
            toast.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' :
            'bg-blue-900/90 border-blue-700 text-blue-100'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-400" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />}
          {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0 text-blue-400" />}
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Progress Steps ──────────────────────────────────────────────────────────

function ProgressSteps({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-sm font-medium text-blue-400">Finding leads...</span>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i < currentStep ? 'bg-green-500 text-white' :
              i === currentStep ? 'bg-blue-500 text-white animate-pulse' :
              'bg-gray-700 text-gray-500'
            }`}>
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${
              i < currentStep ? 'text-green-400' :
              i === currentStep ? 'text-white font-medium' :
              'text-gray-500'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── No Leads Alert ──────────────────────────────────────────────────────────

function NoLeadsAlert({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-yellow-300 font-semibold mb-2">No Leads Found</h4>
          <p className="text-yellow-200/80 text-sm mb-4">{message}</p>
          <div className="bg-yellow-900/30 border border-yellow-700/30 rounded-lg p-3">
            <p className="text-yellow-300 text-xs font-semibold uppercase tracking-wide mb-2">Suggestions:</p>
            <ul className="text-sm text-yellow-200/70 space-y-1">
              <li>• Try a broader category (e.g. &quot;Home Services&quot; instead of a specific trade)</li>
              <li>• Try a different or nearby ZIP code / city</li>
              <li>• Try a larger metro area (e.g. &quot;Phoenix&quot; instead of a suburb)</li>
              <li>• Some areas have very few businesses without websites</li>
            </ul>
          </div>
        </div>
        <button onClick={onDismiss} className="text-yellow-400/60 hover:text-yellow-300">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'research' | 'generate' | 'pipeline'>('research')
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [category, setCategory] = useState('home services')
  const [leads, setLeads] = useState<Business[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { repo?: string; url?: string; palette?: string; layout?: string; variation?: string }>>({})

  // Progress state
  const [searchStep, setSearchStep] = useState(0)
  const [showProgress, setShowProgress] = useState(false)
  const [noLeadsError, setNoLeadsError] = useState<string | null>(null)

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  // Pipeline state
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [pitchingLead, setPitchingLead] = useState<string | null>(null)

  // Auto-scroll ref
  const resultsRef = useRef<HTMLDivElement>(null)

  const SEARCH_STEPS = [
    'Connecting to Google Maps API...',
    'Searching businesses in your area...',
    'Filtering by rating (4+ stars)...',
    'Checking which businesses have no website...',
    'Compiling qualified leads...',
  ]

  // Toast helpers
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const fetchPipeline = useCallback(async () => {
    setPipelineLoading(true)
    try {
      const resp = await fetch(`${API_URL}/pipeline`)
      const data = await resp.json()
      const normalized: PipelineLead[] = (data.leads || []).map((l: PipelineLead) => ({
        ...l,
        preview_url: l.preview_url ? ensureHttps(l.preview_url) : null,
      }))
      setPipelineLeads(normalized)
    } catch (err) {
      console.error('Pipeline fetch failed:', err)
    }
    setPipelineLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'pipeline') {
      fetchPipeline()
    }
  }, [activeTab, fetchPipeline])

  const researchLeads = async () => {
    setLoading(true)
    setShowProgress(true)
    setSearchStep(0)
    setNoLeadsError(null)
    setLeads([])

    const stepTimers: NodeJS.Timeout[] = []
    stepTimers.push(setTimeout(() => setSearchStep(1), 800))
    stepTimers.push(setTimeout(() => setSearchStep(2), 2000))
    stepTimers.push(setTimeout(() => setSearchStep(3), 4000))
    stepTimers.push(setTimeout(() => setSearchStep(4), 6000))

    try {
      const body: Record<string, string> = { category }
      if (zipCode) body.zip_code = zipCode
      if (city) body.city = city
      if (state) body.state = state

      const resp = await fetch(`${API_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      stepTimers.forEach(t => clearTimeout(t))

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ detail: 'Unknown error' }))
        const detail = errorData.detail
        
        if (resp.status === 404 && typeof detail === 'object' && detail.error === 'no_leads_found') {
          setNoLeadsError(detail.message || 'No leads found matching your criteria.')
          addToast('error', 'No leads found. Try different search criteria.')
        } else {
          const msg = typeof detail === 'string' ? detail : detail?.message || 'Search failed'
          addToast('error', `Error: ${msg}`)
          setNoLeadsError(msg)
        }
        setShowProgress(false)
        setLoading(false)
        return
      }

      const data = await resp.json()
      setSearchStep(5)

      await new Promise(r => setTimeout(r, 500))
      setShowProgress(false)

      // Handle 200 OK with empty list as "no leads found"
      if (Array.isArray(data) && data.length === 0) {
        setNoLeadsError('No businesses matching criteria found. Try a broader category or different location.')
        addToast('info', 'No leads found. Try adjusting your search criteria.')
        setLoading(false)
        return
      }

      setLeads(data)

      const newPipelineLeads: PipelineLead[] = data.map((biz: Business, idx: number) => ({
        id: Date.now() + idx,
        name: biz.name,
        phone: biz.phone,
        address: biz.address,
        rating: biz.rating,
        reviews: biz.reviews,
        status: 'research',
        repo_url: null,
        preview_url: null,
        created_at: new Date().toISOString(),
        palette: null,
        layout: null,
        variation_id: null,
      }))
      
      setPipelineLeads(prev => {
        const existingNames = new Set(prev.map(l => l.name))
        const uniqueNew = newPipelineLeads.filter(l => !existingNames.has(l.name))
        return [...uniqueNew, ...prev]
      })

      addToast('success', `Found ${data.length} leads without websites!`)

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)

    } catch (err) {
      stepTimers.forEach(t => clearTimeout(t))
      console.error('Research failed:', err)
      addToast('error', 'Network error. Check your connection and try again.')
      setShowProgress(false)
    }
    setLoading(false)
  }

  const generateSite = async (biz: Business) => {
    setGenerating(biz.name)
    addToast('info', `Generating site for ${biz.name}...`)
    try {
      const genResp = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: biz.name,
          phone: biz.phone || '(555) 000-0000',
          services: biz.services.length > 0 ? biz.services : [category],
          city: city || undefined,
          state: state || undefined,
          place_id: biz.place_id || undefined,
          website_status: biz.website_status || undefined,
          website_domain: biz.website_domain || undefined,
          website_age_years: biz.website_age_years || undefined,
        }),
      })

      if (!genResp.ok) {
        const err = await genResp.json().catch(() => ({}))
        addToast('error', `Generate failed: ${err.detail || 'Unknown error'}`)
        setGenerating(null)
        return
      }

      const genData: GenerateResult = await genResp.json()

      const repoName = genData.repo.split('/')[1]
      addToast('info', `Deploying ${biz.name} to Vercel...`)

      const deployResp = await fetch(`${API_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repoName }),
      })

      if (!deployResp.ok) {
        const err = await deployResp.json().catch(() => ({}))
        addToast('error', `Deploy failed: ${err.detail || 'Unknown error'}`)
        setGenerating(null)
        return
      }

      const deployData: DeployResult = await deployResp.json()

      const deployUrl = ensureHttps(deployData.url)

      setResults(prev => ({
        ...prev,
        [biz.name]: {
          repo: genData.repo_url,
          url: deployUrl,
          palette: genData.palette,
          layout: genData.layout_type,
          variation: genData.variation_id,
        }
      }))

      // Update pipeline leads state
      setPipelineLeads(prev => prev.map(l => 
        l.name === biz.name 
          ? { ...l, status: 'deployed', repo_url: genData.repo_url, preview_url: deployUrl, palette: genData.palette || null, layout: genData.layout_type || null, variation_id: genData.variation_id || null }
          : l
      ))

      addToast('success', `${biz.name} is LIVE at ${deployUrl}`)

      // Auto-sync: refresh pipeline in background so Pipeline tab is fresh
      fetchPipeline()

      // Auto-switch to Pipeline tab after a brief delay so user sees source of truth
      setTimeout(() => {
        setActiveTab('pipeline')
        addToast('info', 'Switched to Pipeline — your deployed lead is ready to pitch!')
      }, 1500)

    } catch (err) {
      console.error('Generate failed:', err)
      addToast('error', `Failed to generate site for ${biz.name}`)
    }
    setGenerating(null)
  }

  const sendOutreach = async (biz: Business) => {
    // Check results from current session, or fall back to pipeline lead's preview_url
    const result = results[biz.name]
    const previewUrl = result?.url || pipelineLeads.find(l => l.name === biz.name)?.preview_url
    if (!previewUrl) {
      addToast('error', `Cannot pitch ${biz.name}: no preview URL available. Deploy first.`)
      return
    }
    try {
      const resp = await fetch(`${API_URL}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: biz.name,
          phone: biz.phone || '',
          preview_url: previewUrl,
          city,
        }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        addToast('error', `Pitch failed: ${err.detail || 'Unknown error'}`)
        return
      }
      addToast('success', `Outreach sent for ${biz.name}!`)
      setPipelineLeads(prev => prev.map(l => 
        l.name === biz.name ? { ...l, status: 'pitched' } : l
      ))
      // Refresh pipeline to stay in sync
      fetchPipeline()
    } catch (err) {
      console.error('Outreach failed:', err)
      addToast('error', `Outreach failed for ${biz.name}`)
    }
  }

  // Send Pitch from Pipeline tab (calls /outreach with lead data)
  const sendPitchFromPipeline = async (lead: PipelineLead) => {
    if (!lead.preview_url) {
      addToast('error', `Cannot pitch ${lead.name}: no preview URL yet. Deploy first.`)
      return
    }
    setPitchingLead(lead.name)
    try {
      const resp = await fetch(`${API_URL}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: lead.name,
          phone: lead.phone || '',
          preview_url: lead.preview_url,
          city: '',
        }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        addToast('error', `Pitch failed: ${err.detail || 'Unknown error'}`)
        setPitchingLead(null)
        return
      }

      addToast('success', `Pitch Sent! Outreach prepared for ${lead.name}`)
      // Refresh the lead's status in UI
      setPipelineLeads(prev => prev.map(l => 
        l.name === lead.name ? { ...l, status: 'pitched' } : l
      ))
    } catch (err) {
      console.error('Pitch failed:', err)
      addToast('error', `Pitch failed for ${lead.name}`)
    }
    setPitchingLead(null)
  }

  const updateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      await fetch(`${API_URL}/leads/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, status: newStatus }),
      })
      fetchPipeline()
      addToast('success', `Lead moved to "${newStatus}"`)
    } catch (err) {
      console.error('Status update failed:', err)
      addToast('error', 'Failed to update lead status')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'research': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'generated': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'deployed': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'pitched': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getNextStep = (status: string) => {
    switch (status) {
      case 'research': return 'Next: Generate & deploy a site for this lead.'
      case 'generated': return 'Next: Deploy the generated site so it goes live.'
      case 'deployed': return 'Next: Send the pitch so the business sees their new site.'
      case 'pitched': return "Next: Follow up in 2-3 days if you don't hear back."
      default: return ''
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <header className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">FastTrack Builds</h1>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 hidden sm:inline">v3.2</span>
          </div>
          <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
            {(['research', 'generate', 'pipeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {tab === 'research' ? '🔍 Find' : tab === 'generate' ? '⚡ Build' : '📊 Pipeline'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'research' && (
          <div>
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Lead Research</h2>
              <p className="text-sm sm:text-base text-gray-400">Find home service businesses with great reviews but no website. Location is optional (defaults to Phoenix, AZ).</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">ZIP Code</label>
                  <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="85383" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surprise" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">State</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="AZ" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white focus:outline-none focus:border-blue-500">
                    <option value="home services">Home Services</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="landscaping">Landscaping</option>
                    <option value="HVAC">HVAC</option>
                    <option value="roofing">Roofing</option>
                    <option value="electrical">Electrical</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="painting">Painting</option>
                    <option value="pest control">Pest Control</option>
                  </select>
                </div>
              </div>
              <button onClick={researchLeads} disabled={loading} className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm sm:text-base">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Searching...' : 'Find Leads'}
              </button>
            </div>

            {/* Progress Steps */}
            {showProgress && (
              <ProgressSteps currentStep={searchStep} steps={SEARCH_STEPS} />
            )}

            {/* No Leads Alert */}
            {noLeadsError && (
              <NoLeadsAlert message={noLeadsError} onDismiss={() => setNoLeadsError(null)} />
            )}

            {/* Results */}
            <div ref={resultsRef}>
              {leads.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      {leads.length} Leads Found
                    </h3>
                    <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                      All without websites • 4+ stars
                    </span>
                  </div>
                  <div className="grid gap-3 sm:gap-4">
                    {leads.map((biz, i) => {
                      const pipelineMatch = pipelineLeads.find(l => l.name === biz.name)
                      const nextStep = results[biz.name]
                        ? getNextStep('deployed')
                        : pipelineMatch
                        ? getNextStep(pipelineMatch.status)
                        : ''
                      return (
                      <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="text-white font-semibold text-sm sm:text-base truncate">{biz.name}</h4>
                            {biz.rating && <span className="flex items-center gap-1 text-yellow-500 text-xs sm:text-sm"><Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />{biz.rating}</span>}
                            {biz.reviews && <span className="text-xs text-gray-500">({biz.reviews} reviews)</span>}
                            {biz.website_status === 'outdated' ? (
                              <>
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                                  Outdated Website{biz.website_age_years ? ` (${Math.round(biz.website_age_years)}y)` : ''}
                                </span>
                                {biz.website_domain && (
                                  <a href={ensureHttps(biz.website_domain)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 hover:underline">
                                    {biz.website_domain} <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </>
                            ) : (
                              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">No Website</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-400">
                            {biz.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {biz.phone}</span>}
                            {biz.address && <span className="flex items-center gap-1 truncate max-w-[250px]"><MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" /> {biz.address}</span>}
                          </div>
                          {nextStep && (
                            <p className="flex items-center gap-1 text-xs text-blue-400/80 mt-1.5">
                              <ArrowRight className="w-3 h-3 flex-shrink-0" /> {nextStep}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {results[biz.name] ? (
                            <>
                              <div className="flex flex-col items-end gap-1 mr-2">
                                <a href={results[biz.name].url} target="_blank" className="flex items-center gap-1 text-green-400 text-xs sm:text-sm hover:underline">
                                  <CheckCircle className="w-4 h-4" /> Live<ExternalLink className="w-3 h-3" />
                                </a>
                                {results[biz.name].variation && (
                                  <span className="text-xs text-gray-500">{results[biz.name].palette}</span>
                                )}
                              </div>
                              <button onClick={() => sendOutreach(biz)} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm px-3 py-1.5 rounded-lg">
                                <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Pitch
                              </button>
                            </>
                          ) : pipelineMatch?.preview_url ? (
                            <>
                              <a href={pipelineMatch.preview_url} target="_blank" className="flex items-center gap-1 text-green-400 text-xs sm:text-sm hover:underline mr-2">
                                <CheckCircle className="w-4 h-4" /> Live<ExternalLink className="w-3 h-3" />
                              </a>
                              <button onClick={() => sendOutreach(biz)} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm px-3 py-1.5 rounded-lg">
                                <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Pitch
                              </button>
                            </>
                          ) : (
                            <button onClick={() => generateSite(biz)} disabled={generating === biz.name} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap">
                              {generating === biz.name ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</>
                              ) : (
                                <><Globe className="w-3.5 h-3.5" /> Generate & Deploy</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'generate' && (
          <div>
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Manual Generate</h2>
              <p className="text-sm sm:text-base text-gray-400">Generate a unique site for a specific business. Each site gets a random palette, layout, and imagery.</p>
            </div>
            <ManualGenerateForm apiUrl={API_URL} addToast={addToast} fetchPipeline={fetchPipeline} goToPipeline={() => setActiveTab('pipeline')} />
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div>
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Pipeline</h2>
                <p className="text-sm sm:text-base text-gray-400">Track all leads and send pitches directly from here.</p>
              </div>
              <button
                onClick={fetchPipeline}
                disabled={pipelineLoading}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition-colors self-start sm:self-auto"
              >
                <RefreshCw className={`w-4 h-4 ${pipelineLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {pipelineLoading && pipelineLeads.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-500" />
                <p className="text-gray-400">Loading pipeline...</p>
              </div>
            ) : pipelineLeads.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
                <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No leads in pipeline yet. Generate some sites first!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
                  <span className="text-sm text-gray-400">{pipelineLeads.length} leads</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                      {pipelineLeads.filter(l => l.status === 'research').length} Research
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                      {pipelineLeads.filter(l => l.status === 'generated').length} Generated
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                      {pipelineLeads.filter(l => l.status === 'deployed').length} Deployed
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                      {pipelineLeads.filter(l => l.status === 'pitched').length} Pitched
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  {pipelineLeads.map((lead) => (
                    <div key={lead.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                            <h4 className="text-white font-semibold text-sm sm:text-base truncate">{lead.name}</h4>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusColor(lead.status)}`}>
                              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                            </span>
                            {lead.rating && (
                              <span className="flex items-center gap-1 text-yellow-500 text-xs sm:text-sm">
                                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />{lead.rating}
                              </span>
                            )}
                            {lead.website_status === 'outdated' && (
                              <>
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                                  Outdated Website{lead.website_age_years ? ` (${Math.round(lead.website_age_years)}y)` : ''}
                                </span>
                                {lead.website_domain && (
                                  <a href={ensureHttps(lead.website_domain)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 hover:underline">
                                    {lead.website_domain} <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-400">
                            {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {lead.phone}</span>}
                            {lead.address && <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-none"><MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" /> {lead.address}</span>}
                            {lead.created_at && <span className="text-gray-500 text-xs">{new Date(lead.created_at).toLocaleDateString()}</span>}
                          </div>
                          {/* Design variety info */}
                          {(lead.palette || lead.layout) && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Palette className="w-3 h-3 text-gray-500" />
                              {lead.palette && <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{lead.palette}</span>}
                              {lead.layout && <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{lead.layout}</span>}
                              {lead.variation_id && <span className="text-xs text-gray-500 font-mono">#{lead.variation_id}</span>}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-3">
                            {lead.repo_url && (
                              <a href={lead.repo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 text-xs sm:text-sm hover:underline">
                                <GitBranch className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Repo
                              </a>
                            )}
                            {lead.preview_url && (
                              <a href={lead.preview_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-400 text-xs sm:text-sm hover:underline">
                                <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Preview
                              </a>
                            )}
                          </div>
                          {getNextStep(lead.status) && (
                            <p className="flex items-center gap-1 text-xs text-blue-400/80 mt-2">
                              <ArrowRight className="w-3 h-3 flex-shrink-0" /> {getNextStep(lead.status)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Show "Send Pitch" button for deployed leads instead of "Mark Pitched" */}
                          {lead.status === 'deployed' && lead.preview_url && (
                            <button
                              onClick={() => sendPitchFromPipeline(lead)}
                              disabled={pitchingLead === lead.name}
                              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs sm:text-sm px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {pitchingLead === lead.name ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                              ) : (
                                <><Send className="w-3.5 h-3.5" /> Send Pitch</>
                              )}
                            </button>
                          )}
                          {/* For non-deployed statuses, show the advance button (but not "Mark Pitched") */}
                          {lead.status === 'research' && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'generated')}
                              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs sm:text-sm px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              Mark Generated
                            </button>
                          )}
                          {lead.status === 'generated' && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, 'deployed')}
                              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs sm:text-sm px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              Mark Deployed
                            </button>
                          )}
                          {/* Pitched leads show a checkmark */}
                          {lead.status === 'pitched' && (
                            <span className="flex items-center gap-1 text-purple-400 text-xs sm:text-sm px-3 py-1.5">
                              <CheckCircle className="w-3.5 h-3.5" /> Pitched
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Custom CSS for toast animation */}
      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

function ManualGenerateForm({ apiUrl, addToast, fetchPipeline, goToPipeline }: { apiUrl: string; addToast: (type: Toast['type'], message: string) => void; fetchPipeline: () => Promise<void>; goToPipeline: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [services, setServices] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ repo_url?: string; deploy_url?: string; palette?: string; layout?: string; variation?: string } | null>(null)

  const handleGenerate = async () => {
    if (!name || !phone) return
    setLoading(true)
    addToast('info', `Building site for ${name}...`)
    try {
      const genResp = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: name,
          phone,
          services: services.split(',').map(s => s.trim()).filter(Boolean),
          city: city || undefined,
          state: state || undefined,
        }),
      })
      if (!genResp.ok) {
        const err = await genResp.json().catch(() => ({}))
        addToast('error', `Generate failed: ${err.detail || 'Unknown error'}`)
        setLoading(false)
        return
      }
      const genData = await genResp.json()
      const repoName = genData.repo.split('/')[1]

      addToast('info', `Deploying to Vercel...`)
      const deployResp = await fetch(`${apiUrl}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repoName }),
      })
      if (!deployResp.ok) {
        const err = await deployResp.json().catch(() => ({}))
        addToast('error', `Deploy failed: ${err.detail || 'Unknown error'}`)
        setLoading(false)
        return
      }
      const deployData = await deployResp.json()
      const deployUrl = ensureHttps(deployData.url)
      setResult({
        repo_url: genData.repo_url,
        deploy_url: deployUrl,
        palette: genData.palette,
        layout: genData.layout_type,
        variation: genData.variation_id,
      })
      addToast('success', `${name} is LIVE at ${deployUrl}`)

      // Auto-sync: refresh pipeline in background
      fetchPipeline()

    } catch (err) {
      console.error(err)
      addToast('error', 'Network error during generation')
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div>
          <label className="block text-xs sm:text-sm text-gray-400 mb-1">Business Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white" placeholder="Joe's Plumbing" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-gray-400 mb-1">Phone *</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white" placeholder="(480) 555-1234" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-gray-400 mb-1">Services (comma-separated)</label>
          <input type="text" value={services} onChange={e => setServices(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white" placeholder="Plumbing, Drain Cleaning" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm text-gray-400 mb-1">City</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white" placeholder="Peoria" />
          </div>
          <div className="w-16 sm:w-20">
            <label className="block text-xs sm:text-sm text-gray-400 mb-1">State</label>
            <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white" placeholder="AZ" />
          </div>
        </div>
      </div>
      <button onClick={handleGenerate} disabled={loading || !name || !phone} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {loading ? 'Building...' : 'Generate & Deploy'}
      </button>
      {result && (
        <div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p className="text-green-400 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Site Generated & Deployed!</p>
          <div className="mt-2 space-y-1 text-sm">
            {result.repo_url && <a href={result.repo_url} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline truncate">GitHub: {result.repo_url}</a>}
            {result.deploy_url && <a href={result.deploy_url} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline truncate">Live: {result.deploy_url}</a>}
            {result.palette && <p className="text-gray-400 text-xs sm:text-sm">Palette: {result.palette} | Layout: {result.layout} | Variation: {result.variation}</p>}
          </div>
          <div className="mt-3 pt-3 border-t border-green-800/50 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <p className="flex items-center gap-1 text-xs text-blue-300">
              <ArrowRight className="w-3 h-3 flex-shrink-0" /> Next: Head to Pipeline to track status and send the pitch.
            </p>
            <button onClick={goToPipeline} className="flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              <GitBranch className="w-3 h-3" /> Go to Pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

