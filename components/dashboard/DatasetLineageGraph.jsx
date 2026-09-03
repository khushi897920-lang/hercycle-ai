'use me'
'use client'

import React, { useState } from 'react'
import {
  Database,
  Cpu,
  GitBranch,
  Info,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Filter,
  Layers,
  X
} from 'lucide-react'

export default function DatasetLineageGraph({ lineageData }) {
  const [selectedNode, setSelectedNode] = useState(null)
  const [copiedHash, setCopiedHash] = useState(false)

  if (!lineageData || !lineageData.datasets || lineageData.datasets.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        <GitBranch size={32} style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
        <p>No dataset lineage topology available for current filters.</p>
      </div>
    )
  }

  const { datasets, preprocessing, models, edges } = lineageData

  const handleCopyHash = (hash) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(hash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    }
  }

  return (
    <div className="glass-card lineage-card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '9999px', marginBottom: '0.5rem' }}>
            <GitBranch size={14} />
            <span>Dataset Versioning & Lineage Engine</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            End-to-End Data Lineage Graph
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Track version hashes, sample sizes, preprocessing steps, and model lineage bindings.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', gap: '1rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} /> Datasets ({datasets.length})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} /> Preprocessing ({preprocessing.length})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} /> Models ({models.length})
            </span>
          </div>
        </div>
      </div>

      {/* Graph Visual Grid Layout */}
      <div style={{ position: 'relative', minHeight: '380px', overflowX: 'auto', padding: '1rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2.5rem', minWidth: '780px', position: 'relative', zIndex: 2 }}>
          {/* Column 1: Datasets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} /> Datasets & Version Hashes
            </div>
            {datasets.map((ds) => (
              <div
                key={ds.id}
                onClick={() => setSelectedNode({ type: 'dataset', data: ds })}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: selectedNode?.data?.id === ds.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.75)',
                  border: selectedNode?.data?.id === ds.id ? '1px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedNode?.data?.id === ds.id ? '0 0 15px rgba(56, 189, 248, 0.3)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>{ds.label}</span>
                  <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                    #{ds.shortHash}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{ds.sampleCount.toLocaleString()} samples</span>
                  <span>{new Date(ds.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Column 2: Preprocessing Transformations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#a855f7', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={14} /> Preprocessing Steps
            </div>
            {preprocessing.map((prep) => (
              <div
                key={prep.id}
                onClick={() => setSelectedNode({ type: 'preprocessing', data: prep })}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: selectedNode?.data?.id === prep.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(15, 23, 42, 0.75)',
                  border: selectedNode?.data?.id === prep.id ? '1px solid #a855f7' : '1px solid rgba(168, 85, 247, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedNode?.data?.id === prep.id ? '0 0 15px rgba(168, 85, 247, 0.3)' : 'none'
                }}
              >
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {prep.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {prep.steps.map((step, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.7rem',
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#d8b4fe',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px'
                      }}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Column 3: Trained ML Models */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#34d399', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Cpu size={14} /> Trained Models
            </div>
            {models.map((mdl) => (
              <div
                key={mdl.id}
                onClick={() => setSelectedNode({ type: 'model', data: mdl })}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: selectedNode?.data?.id === mdl.id ? 'rgba(52, 211, 153, 0.2)' : 'rgba(15, 23, 42, 0.75)',
                  border: selectedNode?.data?.id === mdl.id ? '1px solid #34d399' : '1px solid rgba(52, 211, 153, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedNode?.data?.id === mdl.id ? '0 0 15px rgba(52, 211, 153, 0.3)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>{mdl.label}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    {mdl.latestAccuracy}% acc
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={12} color="#34d399" /> Validated & Active
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Node Drawer / Modal */}
      {selectedNode && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            position: 'relative'
          }}
        >
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Info size={18} color="#818cf8" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
              {selectedNode.type === 'dataset' && `Dataset Version Details: ${selectedNode.data.label}`}
              {selectedNode.type === 'preprocessing' && `Preprocessing Steps: ${selectedNode.data.label}`}
              {selectedNode.type === 'model' && `Model Metadata: ${selectedNode.data.label}`}
            </h3>
          </div>

          {selectedNode.type === 'dataset' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0' }}>Full SHA-256 Content Hash:</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#090d16', padding: '0.5rem 0.75rem', borderRadius: '6px', fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  <span>{selectedNode.data.versionHash}</span>
                  <button
                    onClick={() => handleCopyHash(selectedNode.data.versionHash)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}
                    title="Copy Full Hash"
                  >
                    {copiedHash ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0' }}>Sample Count & Creation Date:</p>
                <div style={{ color: '#e2e8f0', padding: '0.5rem 0' }}>
                  <strong>{selectedNode.data.sampleCount.toLocaleString()}</strong> rows | Created {new Date(selectedNode.data.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {selectedNode.type === 'preprocessing' && (
            <div style={{ fontSize: '0.85rem' }}>
              <p style={{ color: '#94a3b8', margin: '0 0 0.5rem 0' }}>Transformation Steps Applied:</p>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#e2e8f0' }}>
                {selectedNode.data.steps.map((s, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>{s}</li>
                ))}
              </ol>
              {selectedNode.data.parameters && (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ color: '#94a3b8', margin: '0 0 0.25rem 0' }}>Hyper-parameters / Config:</p>
                  <pre style={{ background: '#090d16', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', color: '#d8b4fe', margin: 0 }}>
                    {JSON.stringify(selectedNode.data.parameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {selectedNode.type === 'model' && (
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
              <p style={{ margin: '0 0 0.35rem 0' }}>Model ID: <code style={{ color: '#34d399' }}>{selectedNode.data.modelId}</code></p>
              <p style={{ margin: 0 }}>Latest Evaluation Accuracy: <strong>{selectedNode.data.latestAccuracy}%</strong></p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
