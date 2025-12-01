import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const CheckoutPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cartTotal, setCartTotal] = useState(0)

  const [formData, setFormData] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
  })

  const userId = 'user123'

  // Generate random payment data
  const generateRandomPaymentData = () => {
    const names = ['John Smith', 'Jane Doe', 'Michael Johnson', 'Sarah Williams', 'David Brown', 'Emily Davis']
    const randomName = names[Math.floor(Math.random() * names.length)]

    // Generate random 16-digit card number
    const cardNumber = Array.from({ length: 4 }, () =>
      Math.floor(1000 + Math.random() * 9000)
    ).join(' ')

    // Generate random expiry date (future date)
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
    const year = String(25 + Math.floor(Math.random() * 5)) // 2025-2029
    const expiryDate = `${month}/${year}`

    // Generate random CVV
    const cvv = String(Math.floor(100 + Math.random() * 900))

    return {
      cardHolder: randomName,
      cardNumber,
      expiryDate,
      cvv,
    }
  }

  useEffect(() => {
    fetchCart()
    // Auto-fill with random payment data
    setFormData(generateRandomPaymentData())
  }, [])

  const fetchCart = async () => {
    try {
      const response = await axios.get(`http://localhost:3010/api/cart/${userId}`)
      setCartTotal(response.data.total)
    } catch (error) {
      console.error('Failed to fetch cart:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await axios.post('http://localhost:3010/api/orders', {
        userId,
        paymentDetails: {
          ...formData,
        },
      })

      const order = response.data
      navigate(`/order/${order.orderId}`)
    } catch (error: any) {
      console.error('Order failed:', error)
      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Payment failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>Checkout</h1>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="checkout-form">
        <h2 style={{ marginBottom: '1.5rem' }}>Payment Information</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Total: <strong>${cartTotal.toFixed(2)}</strong>
        </p>

        <div className="form-group">
          <label>Card Holder Name</label>
          <input
            type="text"
            required
            value={formData.cardHolder}
            onChange={(e) => setFormData({ ...formData, cardHolder: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div className="form-group">
          <label>Card Number</label>
          <input
            type="text"
            required
            value={formData.cardNumber}
            onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Expiry Date</label>
            <input
              type="text"
              required
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              placeholder="MM/YY"
              maxLength={5}
            />
          </div>

          <div className="form-group">
            <label>CVV</label>
            <input
              type="text"
              required
              value={formData.cvv}
              onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
              placeholder="123"
              maxLength={3}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Complete Purchase'}
        </button>
      </form>
    </div>
  )
}

export default CheckoutPage
