'use client'

import { useState } from 'react'
import { Search, Rocket, Send, Globe, Phone, Star, MapPin, Loader2, CheckCircle, ExternalLink } from 'lucide-react'

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

interface GenerateResult {
  status: string
  repo: string
  repo_url: string
  message: string
}

interface DeployResult {
  status: string
  url: string
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

      setResults(prev => ({
        ...prev,
        [biz.name]: { repo: genData.repo_url, url: `https://${deployData.url}` }
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
            <div className="mb-8"><h2 className="text-2xl font-bold text-white mb-2">Lead Research</h2><p className="text-gray-400">Find home service businesses with great reviews but no website.</p></div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
              <div className="grid sm:grid-cols-4 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">ZIP Code</label><input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="85001" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">City</label><input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Phoenix" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">State</label><input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="AZ" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"><option value="home services">Home Services</option><option value="plumbing">Plumbing</option><option value="landscaping">Landscaping</option><option value="HVAC">HVAC</option><option value="roofing">Roofing</option><option value="electrical">Electrical</option><option value="cleaning">Cleaning</option><option value="painting">Painting</option><option value="pest control">Pest Control</option></select></div>
              </div>
              <button onClick={researchLeads} disabled={loading} className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{loading ? 'Searching...' : 'Find Leads'}</button>
            </div>
            {leads.length > 0 && (<div className="space-y-4"><h3 className="text-lg font-semibold text-white">{leads.length} Leads Found</h3><div className="grid gap-4">{leads.map((biz, i) => (<div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between"><div className="flex-1"><div className="flex items-center gap-3 mb-1"><h4 className="text-white font-semibold">{biz.name}</h4>{biz.rating && <span className="flex items-center gap-1 text-yellow-500 text-sm"><Star className="w-3.5 h-3.5 fill-current" />{biz.rating}</span>}{!biz.has_website && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">No Website</span>}</div><div className="flex items-center gap-4 text-sm text-gray-400">{biz.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {biz.phone}</span>}{biz.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {biz.address}</span>}</div></div><div className="flex items-center gap-2">{results[biz.name] ? (<><a href={results[biz.name].url} target="_blank" className="flex items-center gap-1 text-green-400 text-sm hover:underline"><CheckCircle className="w-4 h-4" /> Live<ExternalLink className="w-3 h-3" /></a><button onClick={() => sendOutreach(biz)} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1.5 rounded-lg"><Send className="w-3.5 h-3.5" /> Outreach</button></>) : (<button onClick={() => generateSite(biz)} disabled={generating === biz.name} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">{generating === biz.name ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</>) : (<><Globe className="w-3.5 h-3.5" /> Generate & Deploy</>)}</button>)}</div></div>))}</div></div>)}
          </div>
        )}
        {activeTab === 'generate' && (<div><div className="mb-8"><h2 className="text-2xl font-bold text-white mb-2">Manual Generate</h2><p className="text-gray-400">Generate a site for a specific business manually.</p></div><ManualGenerateForm apiUrl={API_URL} /></div>)}
        {activeTab === 'pipeline' && (<div><div className="mb-8"><h2 className="text-2xl font-bold text-white mb-2">Pipeline</h2><p className="text-gray-400">Track all generated sites and outreach status.</p></div><div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500"><Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Pipeline tracking coming soon.</p></div></div>)}
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
      const genResp = await fetch(`${apiUrl}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_name: name, phone, services: services.split(',').map(s => s.trim()).filter(Boolean), city, state }) })
      const genData = await genResp.json()
      const repoName = genData.repo.split('/')[1]
      const deployResp = await fetch(`${apiUrl}/deploy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo_name: repoName }) })
      const deployData = await deployResp.json()
      setResult({ repo_url: genData.repo_url, deploy_url: `https://${deployData.url}` })
    } catch (err) { console.error(err) }
    setLoading(false)
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div><label className="block text-sm text-gray-400 mb-1">Business Name *</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Joe's Plumbing" /></div>
        <div><label className="block text-sm text-gray-400 mb-1">Phone *</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="(480) 555-1234" /></div>
        <div><label className="block text-sm text-gray-400 mb-1">Services (comma-separated)</label><input type="text" value={services} onChange={e => setServices(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Plumbing, Drain Cleaning" /></div>
        <div className="flex gap-2"><div className="flex-1"><label className="block text-sm text-gray-400 mb-1">City</label><input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="Phoenix" /></div><div className="w-20"><label className="block text-sm text-gray-400 mb-1">State</label><input type="text" value={state} onChange={e => setState(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white" placeholder="AZ" /></div></div>
      </div>
      <button onClick={handleGenerate} disabled={loading || !name || !phone} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}{loading ? 'Building...' : 'Generate & Deploy'}</button>
      {result && (<div className="mt-4 p-4 bg-green-900/20 border border-green-800 rounded-lg"><p className="text-green-400 font-medium flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Site Generated!</p><div className="mt-2 space-y-1 text-sm">{result.repo_url && <a href={result.repo_url} target="_blank" className="block text-blue-400 hover:underline">GitHub: {result.repo_url}</a>}{result.deploy_url && <a href={result.deploy_url} target="_blank" className="block text-blue-400 hover:underline">Live: {result.deploy_url}</a>}</div></div>)}
    </div>
  )
}
