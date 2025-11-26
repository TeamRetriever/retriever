import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

const Header = () => {
  const [cartCount, setCartCount] = useState(0)
  const userId = 'user123' // In production, this would come from auth

  useEffect(() => {
    fetchCartCount()
  }, [])

  const fetchCartCount = async () => {
    try {
      const response = await fetch(`http://localhost:3010/api/cart/${userId}`)
      const data = await response.json()
      setCartCount(data.items?.length || 0)
    } catch (error) {
      console.error('Failed to fetch cart:', error)
    }
  }

  // Listen for cart updates
  useEffect(() => {
    const handleCartUpdate = () => {
      fetchCartCount()
    }

    window.addEventListener('cartUpdated', handleCartUpdate)
    return () => window.removeEventListener('cartUpdated', handleCartUpdate)
  }, [])

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          SkyBound Shoes
        </Link>
        <nav className="nav">
          <Link to="/">Home</Link>
          <Link to="/products">Shop</Link>
          <a href="http://localhost:16686" target="_blank" rel="noopener noreferrer">
            Jaeger Traces
          </a>
          <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer">
            Prometheus
          </a>
          <a href="http://localhost:9093" target="_blank" rel="noopener noreferrer">
            AlertManager
          </a>
          <Link to="/cart" className="cart-icon">
            Cart
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
