import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

interface Order {
  orderId: string
  userId: string
  items: any[]
  total: number
  status: string
  paymentTransactionId?: string
  createdAt: string
  error?: string
}

const OrderConfirmationPage = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrder()
    window.dispatchEvent(new Event('cartUpdated'))
  }, [orderId])

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`http://localhost:3010/api/orders/${orderId}`)
      setOrder(response.data)
    } catch (error) {
      console.error('Failed to fetch order:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading order...</div>
  }

  if (!order) {
    return <div className="error">Order not found</div>
  }

  if (order.status === 'failed') {
    return (
      <div className="order-confirmation">
        <h1 style={{ color: '#ff4757' }}>Order Failed</h1>
        <p style={{ margin: '2rem 0', fontSize: '1.1rem' }}>
          {order.error || 'There was an issue processing your order.'}
        </p>
        <button onClick={() => navigate('/cart')} className="btn btn-primary">
          Return to Cart
        </button>
      </div>
    )
  }

  return (
    <div className="order-confirmation">
      <h1>Order Confirmed!</h1>
      <p style={{ fontSize: '1.2rem', margin: '1rem 0' }}>
        Thank you for your purchase!
      </p>

      <div className="order-id">
        Order ID: {order.orderId}
      </div>

      {order.paymentTransactionId && (
        <div style={{ color: '#666', margin: '1rem 0' }}>
          Transaction: {order.paymentTransactionId}
        </div>
      )}

      <div style={{ background: '#f9f9f9', padding: '2rem', borderRadius: '10px', margin: '2rem 0' }}>
        <h3 style={{ marginBottom: '1rem' }}>Order Summary</h3>
        <div style={{ textAlign: 'left' }}>
          {order.items.map((item) => (
            <div key={item.productId} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.name} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: '1rem 0', fontWeight: 'bold', fontSize: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total:</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/')} className="btn btn-primary">
        Continue Shopping
      </button>
    </div>
  )
}

export default OrderConfirmationPage
