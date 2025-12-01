import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { OpenFeatureProvider } from '@openfeature/react-sdk'
import HomePage from './pages/HomePage'
import ProductListPage from './pages/ProductListPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderConfirmationPage from './pages/OrderConfirmationPage'
import FeatureFlagsPage from './pages/FeatureFlagsPage'
import Header from './components/Header'

function App() {
  return (
    <OpenFeatureProvider>
      <Router>
        <div className="app">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductListPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/flags" element={<FeatureFlagsPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </OpenFeatureProvider>
  )
}

export default App
