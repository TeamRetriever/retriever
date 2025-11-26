import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'

interface Product {
  id: string
  name: string
  brand: string
  price: number
  image: string
}

const HomePage = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeaturedProducts()
  }, [])

  const fetchFeaturedProducts = async () => {
    try {
      const response = await axios.get('http://localhost:3010/api/products')
      setFeaturedProducts(response.data.products.slice(0, 4))
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <section className="hero">
        <h1>Elevate Your Game</h1>
        <p>Premium basketball shoes engineered for champions</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/products" className="btn btn-primary">
            Shop Now
          </Link>
          <Link
            to="/flags"
            className="btn"
            style={{
              background: '#667eea',
              color: 'white',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Feature Flags Config
          </Link>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>Featured Shoes</h2>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="product-grid">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="product-card">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-image"
                  />
                  <div className="product-info">
                    <div className="product-brand">{product.brand}</div>
                    <h3 className="product-name">{product.name}</h3>
                    <div className="product-price">${product.price.toFixed(2)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default HomePage
