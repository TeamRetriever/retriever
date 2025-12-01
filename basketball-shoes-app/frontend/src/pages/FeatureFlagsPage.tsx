import { useEffect, useState } from 'react'
import axios from 'axios'
import Toast from '../components/Toast'

interface FlagConfig {
  state: string
  variants: Record<string, any>
  defaultVariant: string
}

interface FlagdConfig {
  flags: Record<string, FlagConfig>
}

const FeatureFlagsPage = () => {
  const [config, setConfig] = useState<FlagdConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await axios.get('http://localhost:3010/api/flags/config')
      setConfig(response.data)
    } catch (error) {
      console.error('Failed to fetch config:', error)
      setToast({ message: 'Failed to load flag configuration', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (flagKey: string) => {
    if (!config) return

    setConfig((prevConfig) => {
      if (!prevConfig) return prevConfig

      const flag = prevConfig.flags[flagKey]
      const currentVariant = flag.defaultVariant
      const newVariant = currentVariant === 'on' ? 'off' : 'on'

      return {
        ...prevConfig,
        flags: {
          ...prevConfig.flags,
          [flagKey]: {
            ...flag,
            defaultVariant: newVariant,
          },
        },
      }
    })
  }

  const handleVariantChange = (flagKey: string, newVariant: string) => {
    if (!config) return

    setConfig((prevConfig) => {
      if (!prevConfig) return prevConfig

      const flag = prevConfig.flags[flagKey]

      return {
        ...prevConfig,
        flags: {
          ...prevConfig.flags,
          [flagKey]: {
            ...flag,
            defaultVariant: newVariant,
          },
        },
      }
    })
  }

  const handleSave = async () => {
    if (!config) return

    try {
      setSaving(true)
      await axios.put('http://localhost:3010/api/flags/config', config)
      setToast({ message: 'Configuration saved successfully! Changes will take effect shortly.', type: 'success' })
    } catch (error) {
      console.error('Failed to save config:', error)
      setToast({ message: 'Failed to save configuration', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const getFlagDescription = (flagKey: string) => {
    const descriptions: Record<string, string> = {
      // Cart Service
      'a3f7b2c8': 'Cart Service - Enable service unavailable mode (returns 503 for all requests)',
      'd4e8c9f1': 'Cart Service - Intermittent failures (50% random failure rate)',
      '5b2d7e9a': 'Cart Service - Enable 10% discount for orders over $200',
      '8c1f4a6b': 'Cart Service - Corrupt cart quantities and totals (±20%)',
      '4e8d1b3f': 'Cart Service - Checkout flow type (single-page vs multi-step)',

      // Product Service
      'f2a9d3e7': 'Product Service - Add 3-5 second delay to all product API requests',
      'b5c8e1f4': 'Product Service - Enforce rate limiting (5 requests per minute)',
      '6d7f2a3c': 'Product Service - Return stale cache data (prices inflated by 20%)',
      '9e4b1c8f': 'Product Service - Inflate response payload size (10x bloat)',
      '3a7e5d2b': 'Product Service - Return corrupted/malformed product data',
      'c4f8a1e6': 'Product Service - Product listing display mode (grid vs list)',

      // Order Service
      '7b3f9d2e': 'Order Service - Simulate 35+ second processing timeout',
      'e6a4c8f1': 'Order Service - Return incomplete/partial order data',
      '2d9e7b4a': 'Order Service - Test duplicate order/idempotency handling',

      // Payment Service
      '4c2f8a6e': 'Payment Service - Force payment gateway errors (all transactions fail)',
      'f8e3b5d1': 'Payment Service - Test payment retry limit exhaustion',

      // Recommendation Service
      '1e9b4f7c': 'Recommendation Service - Add 5-10 second delay to recommendation requests',
      '5a3d8e2f': 'Recommendation Service - Show/hide product recommendations',
      '9f6c2e4b': 'Recommendation Service - Trigger cascading service failures',

      // System-Wide
      '8e5a3d9c': 'System-Wide - Simulate database connection failures',
      '6b4f1e8a': 'System-Wide - Simulate memory leak/pressure conditions',
      '3c7d2f9e': 'API Gateway - Trigger gateway timeout errors',
      'd1e6b8f4': 'System-Wide - Make inventory service unavailable (503 errors)',
      '7f2a9c5e': 'System-Wide - Corrupt distributed tracing context propagation',
      'b9f5e2d6': 'System-Wide - Set global error rate percentage (0/10/25/50/75/100%)',
    }
    return descriptions[flagKey] || 'Configuration setting'
  }

  const getFlagCategory = (flagKey: string) => {
    // Service Configuration
    const serviceConfigFlags = ['a3f7b2c8', '4c2f8a6e', '7b3f9d2e', '8e5a3d9c', 'd1e6b8f4', '3c7d2f9e']
    if (serviceConfigFlags.includes(flagKey)) {
      return 'Service Configuration'
    }

    // Performance & Latency
    const performanceFlags = ['f2a9d3e7', '1e9b4f7c', '6b4f1e8a']
    if (performanceFlags.includes(flagKey)) {
      return 'Performance & Latency'
    }

    // Data Processing
    const dataFlags = ['3a7e5d2b', '8c1f4a6b', 'e6a4c8f1', '6d7f2a3c', '9e4b1c8f']
    if (dataFlags.includes(flagKey)) {
      return 'Data Processing'
    }

    // Testing & Validation
    const testingFlags = ['d4e8c9f1', 'b9f5e2d6', '9f6c2e4b', 'f8e3b5d1', '2d9e7b4a', '7f2a9c5e']
    if (testingFlags.includes(flagKey)) {
      return 'Testing & Validation'
    }

    // Resource Management
    const resourceFlags = ['b5c8e1f4']
    if (resourceFlags.includes(flagKey)) {
      return 'Resource Management'
    }

    // Business Features
    const businessFlags = ['5b2d7e9a', 'c4f8a1e6', '4e8d1b3f', '5a3d8e2f']
    if (businessFlags.includes(flagKey)) {
      return 'Business Features'
    }

    return 'Configuration'
  }

  if (loading) {
    return <div className="loading">Loading configuration...</div>
  }

  if (!config) {
    return <div className="error">Failed to load configuration</div>
  }

  const groupedFlags = Object.entries(config.flags).reduce((acc, [key, flagConfig]) => {
    const category = getFlagCategory(key)
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push({ key, flagConfig })
    return acc
  }, {} as Record<string, Array<{ key: string; flagConfig: FlagConfig }>>)

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Feature Flags Configuration</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Toggle flags below and click "Save Changes" to apply. Changes take effect within a few seconds.
      </p>

      {Object.entries(groupedFlags).map(([category, flags]) => (
        <div key={category} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#667eea' }}>{category}</h2>
          <div style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))'
          }}>
            {flags.map(({ key, flagConfig }) => {
              const isBooleanFlag = flagConfig.variants.on !== undefined && flagConfig.variants.off !== undefined
              const currentValue = flagConfig.defaultVariant
              const displayValue = flagConfig.variants[currentValue]

              return (
                <div
                  key={key}
                  style={{
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    background: 'white',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1rem', margin: 0, marginBottom: '0.5rem' }}>
                        <code style={{ background: '#f5f5f5', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          {key}
                        </code>
                      </h3>
                      <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>
                        {getFlagDescription(key)}
                      </p>
                    </div>

                    {isBooleanFlag ? (
                      <button
                        onClick={() => handleToggle(key)}
                        style={{
                          marginLeft: '1rem',
                          background: currentValue === 'on' ? '#2ecc71' : '#e74c3c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '20px',
                          padding: '0.5rem 1.5rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          minWidth: '80px',
                          transition: 'all 0.2s',
                        }}
                      >
                        {currentValue === 'on' ? 'ON' : 'OFF'}
                      </button>
                    ) : (
                      <select
                        value={currentValue}
                        onChange={(e) => handleVariantChange(key, e.target.value)}
                        style={{
                          marginLeft: '1rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: '2px solid #667eea',
                          background: 'white',
                          color: '#667eea',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                        }}
                      >
                        {Object.keys(flagConfig.variants).map((variant) => (
                          <option key={variant} value={variant}>
                            {variant}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #e0e0e0',
                    fontSize: '0.875rem',
                    color: '#888',
                  }}>
                    Current value: <strong style={{ color: '#333' }}>{JSON.stringify(displayValue)}</strong>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#fff3cd',
        borderRadius: '8px',
        border: '1px solid #ffc107'
      }}>
        <h3 style={{ marginTop: 0, color: '#856404' }}>Important Notes</h3>
        <ul style={{ marginBottom: 0, lineHeight: '1.8', color: '#856404' }}>
          <li>Changes are saved to <code>flagd-config.json</code></li>
          <li>flagd automatically reloads the configuration when the file changes</li>
          <li>It may take a few seconds for changes to propagate to all services</li>
          <li>Refresh the page to see the updated flag values after saving</li>
        </ul>
      </div>
    </div>
  )
}

export default FeatureFlagsPage
