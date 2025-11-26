import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useFlag } from '@openfeature/react-sdk'
import axios from 'axios'

interface Product {
  id: string
  name: string
  brand: string
  price: number
  description: string
  image: string
}

const ProductListPage = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get display mode from feature flag
  const { value: displayMode } = useFlag('product-display-mode', 'grid')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await axios.get('http://localhost:3010/api/products')
      setProducts(response.data.products)
      setError(null)
    } catch (error: any) {
      console.error('Failed to fetch products:', error)
      setError(error.response?.data?.error || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading products...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem' }}>All Basketball Shoes</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Browse our complete collection of premium basketball footwear
      </p>

      <div className={`product-grid${displayMode === 'list' ? ' list-view' : ''}`}>
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/products/${product.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className={`product-card${displayMode === 'list' ? ' list-view' : ''}`}>
              <img
                src={product.image}
                alt={product.name}
                className="product-image"
              />
              <div className="product-info">
                <div className="product-brand">{product.brand}</div>
                <h3 className="product-name">{product.name}</h3>
                <p style={{ color: '#666', margin: '0.5rem 0' }}>
                  {product.description.substring(0, 100)}...
                </p>
                <div className="product-price">${product.price.toFixed(2)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default ProductListPage
