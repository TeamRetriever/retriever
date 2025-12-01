import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useFlag } from '@openfeature/react-sdk'
import axios from 'axios'
import Toast from '../components/Toast'

interface Product {
  id: string
  name: string
  brand: string
  price: number
  description: string
  image: string
  sizes: number[]
  colors: string[]
  inStock: boolean
}

interface RecommendedProduct {
  id: string
  name: string
  brand: string
  price: number
  image: string
}

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const { value: showRecommendations } = useFlag('show-recommendations', true)

  const userId = 'user123'

  useEffect(() => {
    fetchProduct()
    if (showRecommendations) {
      fetchRecommendations()
    }
  }, [id, showRecommendations])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`http://localhost:3010/api/products/${id}`)
      setProduct(response.data)
      setError(null)
    } catch (error: any) {
      console.error('Failed to fetch product:', error)
      setError(error.response?.data?.error || 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const fetchRecommendations = async () => {
    try {
      const recResponse = await axios.get(`http://localhost:3010/api/recommendations/${id}`)
      const productIds = recResponse.data.recommendations

      const productsResponse = await axios.get('http://localhost:3010/api/products')
      const allProducts = productsResponse.data.products

      const recommended = productIds
        .map((rid: string) => allProducts.find((p: Product) => p.id === rid))
        .filter(Boolean)

      setRecommendations(recommended)
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    }
  }

  const addToCart = async () => {
    if (!selectedSize) {
      setToast({ message: 'Please select a size', type: 'info' })
      return
    }

    if (!selectedColor) {
      setToast({ message: 'Please select a color', type: 'info' })
      return
    }

    if (!product) return

    try {
      await axios.post(`http://localhost:3010/api/cart/${userId}/items`, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
      })

      window.dispatchEvent(new Event('cartUpdated'))
      setToast({ message: `Added ${product.name} to cart!`, type: 'success' })
    } catch (error: any) {
      console.error('Failed to add to cart:', error)
      setToast({ message: error.response?.data?.error || 'Failed to add to cart', type: 'error' })
    }
  }

  if (loading) {
    return <div className="loading">Loading product...</div>
  }

  if (error || !product) {
    return <div className="error">{error || 'Product not found'}</div>
  }

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
        <div>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', borderRadius: '10px' }}
          />
        </div>

        <div>
          <div className="product-brand" style={{ fontSize: '1rem' }}>{product.brand}</div>
          <h1 style={{ fontSize: '2.5rem', margin: '1rem 0' }}>{product.name}</h1>
          <div className="product-price" style={{ fontSize: '2rem', margin: '1rem 0' }}>
            ${product.price.toFixed(2)}
          </div>
          <p style={{ color: '#666', lineHeight: '1.6', margin: '1.5rem 0' }}>
            {product.description}
          </p>

          <div style={{ margin: '2rem 0' }}>
            <h3 style={{ marginBottom: '1rem' }}>Select Size</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className="btn"
                  style={{
                    padding: '0.5rem 1rem',
                    background: selectedSize === size ? '#667eea' : 'white',
                    color: selectedSize === size ? 'white' : '#333',
                    border: '2px solid #667eea',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div style={{ margin: '2rem 0' }}>
            <h3 style={{ marginBottom: '1rem' }}>Select Color</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {product.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className="btn"
                  style={{
                    padding: '0.5rem 1rem',
                    background: selectedColor === color ? '#667eea' : 'white',
                    color: selectedColor === color ? 'white' : '#333',
                    border: '2px solid #667eea',
                  }}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={addToCart}
            className="btn btn-primary"
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          >
            Add to Cart
          </button>
        </div>
      </div>

      {showRecommendations && recommendations.length > 0 && (
        <div className="recommendations">
          <h2>You May Also Like</h2>
          <div className="product-grid">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                onClick={() => navigate(`/products/${rec.id}`)}
                className="product-card"
              >
                <img src={rec.image} alt={rec.name} className="product-image" />
                <div className="product-info">
                  <div className="product-brand">{rec.brand}</div>
                  <h3 className="product-name">{rec.name}</h3>
                  <div className="product-price">${rec.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetailPage
