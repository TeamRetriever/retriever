import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
}

interface Cart {
  userId: string
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
}

const CartPage = () => {
  const navigate = useNavigate()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userId = 'user123'

  useEffect(() => {
    fetchCart()
  }, [])

  const fetchCart = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`http://localhost:3010/api/cart/${userId}`)
      setCart(response.data)
      setError(null)
    } catch (error: any) {
      console.error('Failed to fetch cart:', error)
      setError(error.response?.data?.error || 'Failed to load cart')
    } finally {
      setLoading(false)
    }
  }

  const removeItem = async (productId: string) => {
    try {
      await axios.delete(`http://localhost:3010/api/cart/${userId}/items/${productId}`)
      fetchCart()
      window.dispatchEvent(new Event('cartUpdated'))
    } catch (error: any) {
      console.error('Failed to remove item:', error)
      alert(error.response?.data?.error || 'Failed to remove item')
    }
  }

  if (loading) {
    return <div className="loading">Loading cart...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="cart-container">
        <h1>Shopping Cart</h1>
        <p style={{ margin: '2rem 0', color: '#666' }}>Your cart is empty</p>
        <button onClick={() => navigate('/products')} className="btn btn-primary">
          Continue Shopping
        </button>
      </div>
    )
  }

  return (
    <div className="cart-container">
      <h1 style={{ marginBottom: '2rem' }}>Shopping Cart</h1>

      <div className="cart-items">
        {cart.items.map((item) => (
          <div key={item.productId} className="cart-item">
            <img src={item.image} alt={item.name} className="cart-item-image" />
            <div className="cart-item-info">
              <h3>{item.name}</h3>
              <p style={{ color: '#666' }}>Quantity: {item.quantity}</p>
              <p style={{ fontWeight: 'bold' }}>${item.price.toFixed(2)}</p>
            </div>
            <button
              onClick={() => removeItem(item.productId)}
              className="btn btn-danger"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal:</span>
          <span>${cart.subtotal.toFixed(2)}</span>
        </div>
        {cart.discount > 0 && (
          <div className="summary-row" style={{ color: '#2ecc71' }}>
            <span>Discount (10%):</span>
            <span>-${cart.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="summary-row summary-total">
          <span>Total:</span>
          <span>${cart.total.toFixed(2)}</span>
        </div>

        <button
          onClick={() => navigate('/checkout')}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  )
}

export default CartPage
