'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Rocket, Send, Globe, Phone, Star, MapPin, Loader2, CheckCircle, ExternalLink, RefreshCw, GitBranch, ArrowRight } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://76.13.107.20:8100'

interface Business {
  name: string
  phone: string | null
  address: string | null
  rating: number | null
  reviews: number | null
  services: string[]
  has_website: boolean
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
}

interface GenerateResult {
  status: string
  repo: string
  repo_url: string
  message: string
}

interface DeployResult {
  status: string
  url: string
  deployment_state: string
  message: string
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'research' | 'generate' | 'pipeline'>('research')
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [category, setCategory] = useState('home services')
  const [leads, setLeads] = useState<Business[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { repo?: string; url?: string }>>({})

  // Pipeline state
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(false)

  const fetchPipeline = useCallback(async () => {
    setPipelineLoading(true)
    try {
      const resp = await fetch(`${API_URL}/pipeline`)
      const data = await resp.json()
      setPipelineLeads(data.leads || [])
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
    try {
      const resp = await fetch(`${API_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip_code: zipCode, city, state, category }),
      })
      const data = await resp.json()
      setLeads(data)
    } catch (err) {
      console.error('Research failed:', err)
    }
    setLoading(false)
  }

  const generateSite = async (biz: Business) => {
    setGenerating(biz.name)
    try {
      const genResp = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: biz.name,
          phone: biz.phone || '(555) 000-0000',
          services: biz.services.length > 0 ? biz.services : [category],
          city,
          state,
        }),
      })
      const genData: GenerateResult = await genResp.json()

      const repoName = genData.repo.split('/')[1]
      const deployResp = await fetch(`${API_URL}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repoName }),
      })
      const deployData: DeployResult = await deployResp.json()

      // deploy endpoint now returns full URL with https://
      const deployUrl = deployData.url.startsWith('http') ? deployData.url : `https://${deployData.url}`

      setResults(prev => ({
        ...prev,
        [biz.name]: { repo: genData.repo_url, url: deployUrl }
      }))
    } catch (err) {
      console.error('Generate failed:', err)
    }
    setGenerating(null)
  }

  const sendOutreach = async (biz: Business) => {
    const result = results[biz.name]
    if (!result?.url) return
    try {
      await fetch(`${API_URL}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: biz.name,
          phone: biz.phone || '',
          preview_url: result.url,
          city,
        }),
      })
      alert(`Outreach sent for ${biz.name}!`)
    } catch (err) {
      console.error('Outreach failed:', err)
    }
  }

  const updateLeadStatus = async (leadId: number, newStatus: string) => {
    try {
      await fetch(`${API_URL}/leads/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, status: newStatus }),
      })
      fetchPipeline()
    } catch (err) {
      console.error('Status update failed:', err)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'deployed': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'pitched': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getNextStatus = (status: string): string | null => {
    switch (status) {
      case 'generated': return 'deployed'
      case 'deployed': return 'pitched'
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="w-7 h-7 text-blue-500" />
            <h1 className="text-xl font-bold text-white">FastTrack Builds</h1>
          </div>
          <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
            {(['research', 'generate', 'pipeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'research' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Lead Research</h2>
              <p className="text-gray-400">Find home service businesses with great reviews but no website.</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">ZIP Code</label>
                  <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="85001" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">City</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Phoenix" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">State</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="AZ" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
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
              <button onClick={researchLeads} disabled={loading} className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Searching...' : 'Find Leads'}
              </button>
            </div>

            {leads.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">{leads.length} Leads Found</h3>
                <div className="grid gap-4">
                  {leads.map((biz, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-white font-semibold">{biz.name}</h4>
                          {biz.rating && <span className="flex items-center gap-1 text-yellow-500 text-sm"><Star className="w-3.5 h-3.5 fill-current" />{biz.rating}</span>}
                          {!biz.has_website && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">No Website</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          {biz.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {biz.phone}</span>}
                          {biz.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {biz.address}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {results[biz.name] ? (
                          <>
                            <a href={results[biz.name].url} target="_blank" className="flex items-center gap-1 text-green-400 text-sm hover:underline">
                              <CheckCircle className="w-4 h-4" /> Live<ExternalLink className="w-3 h-3" />
                            </a>
                            <button onClick={() => sendOutreach(biz)} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1.5 rounded-lg">
                              <Send className="w-3.5 h-3.5" /> Outreach
                            </button>
                          </>
                        ) : (
                          <button onClick={() => generateSite(biz)} disabled={generating === biz.name} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                            {generating === biz.name ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</>
                            ) : (
                              <><Globe className="w-3.5 h-3.5" /> Generate & Deploy</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'generate' && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Manual Generate</h2>
              <p className="text-gray-400">Generate a site for a specific business manually.</p>
            </div>
            <ManualGenerateForm apiUrl={API_URL} />
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Pipeline</h2>
                <p className="text-gray-400">Track all generated sites and their deployment status.</p>
              </div>
              <button
                onClick={fetchPipeline}
                disabled={pipelineLoading}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
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
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm text-gray-400">{pipelineLeads.length} leads in pipeline</span>
                  <div className="flex gap-2">
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

                <div className="grid gap-4">
                  {pipelineLeads.map((lead) => (
                    <div key={lead.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-semibold">{lead.name}</h4>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusColor(lead.status)}`}>
                              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                            </span>
                            {lead.rating && (
                              <span className="flex items-center gap-1 text-yellow-500 text-sm">
                                <Star className="w-3.5 h-3.5 fill-current" />{lead.rating}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                            {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>}
                            {lead.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {lead.address}</span>}
                            {lead.created_at && <span className="text-gray-500 text-xs">{new Date(lead.created_at).toLocaleDateString()}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-3">
                            {lead.repo_url && (
                              <a href={lead.repo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 text-sm hover:underline">
                                <GitBranch className="w-3.5 h-3.5" /> Repo
                              </a>
                            )}
                            {lead.preview_url && (
                              <a href={lead.preview_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-400 text-sm hover:underline">
                                <ExternalLink className="w-3.5 h-3.5" /> Preview
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getNextStatus(lead.status) && (
                            <button
                              onClick={() => updateLeadStatus(lead.id, getNextStatus(lead.status)!)}
                              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                              {getNextStatus(lead.status) === 'deployed' ? 'Mark Deployed' : 'Mark Pitched'}
                            </button>
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
    </div>
  )
}

function ManualGenerateForm({ apiUrl }: { apiUrl: string }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [services, setServices] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ repo_url?: string; deploy_url?: string } | null>(null)

  const handleGenerate = async () => {
    if (!name || !phone) return
    setLoading(true)
    try {
      const genResp = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: name,
          phone,
          services: services.split(',').map(s => s.trim()).filter(Boolean),
          city,
          state,
        }),
      })
      const genData = await genResp.json()
      const repoName = genData.repo.split('/')[1]
      const deployResp = await fetch(`${apiUrl}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_name: repoName }),
      })
      const deployData = await deployResp.json()
      // Backend now returns full URL with https://
      const deployUrl = deployData.url.startsWith('http') ? deployData.url : `https://${deployData.url}`
      setResult({ repo_url: genData.repo_url, deploy_url: deployUrl })
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Business Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Joe's Plumbing" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone *</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="(480) 555-1234" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Services (comma-separated)</label>
          <input type="text" value={services} onChange={e => setServices(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Plumbing, Drain Cleaning" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">City</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Phoenix" />
          </div>
          <div className="w-20">
            <label className="block text-sm text-gray-400 mb-1">State</label>
            <input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="AZ" />
          </div>
        </div>
      </div>
      <button onClick={handleGenerate} disabled={loading || !name || !phone} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {loading ? 'Building...' : 'Generate & Deploy'}
      </button>
      {result && (
        <div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p className="text-green-400 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Site Generated & Deployed!</p>
          <div className="mt-2 space-y-1 text-sm">
            {result.repo_url && <a href={result.repo_url} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline">GitHub: {result.repo_url}</a>}
            {result.deploy_url && <a href={result.deploy_url} target="_blank" rel="noopener noreferrer" className="block text-blue-400 hover:underline">Live: {result.deploy_url}</a>}
          </div>
        </div>
      )}
    </div>
  )
}
