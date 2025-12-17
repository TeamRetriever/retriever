import 'dotenv/config'; 
import express from 'express'; 
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {requireAuth, showLoginForm, handleLogin, JWT_SECRET, COOKIE_MAX_AGE_DAYS} from './middleware'


const JAEGER_URL = process.env.JAEGER_URL || 'http://query.retriever:16686';
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus.retriever:9090';
const ALERTMANAGER_URL = process.env.ALERTMANAGER_URL || 'http://alertmanager.retriever:9093';

if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable required')
    process.exit(1); 
}

console.log('🔐 Retriever Auth Proxy');
console.log(`   Cookie expiration: ${COOKIE_MAX_AGE_DAYS} days`);
console.log(`   Jaeger:       ${JAEGER_URL}`);
console.log(`   Prometheus:   ${PROMETHEUS_URL}`);
console.log(`   AlertManager: ${ALERTMANAGER_URL}`);


const app = express(); 


app.use(express.json()); 
app.use(express.urlencoded({extended:true})); 
app.use(cookieParser())


app.get('/health', (_req, res) => {
    res.json({status: 'healthy'});
});


app.get('/auth', showLoginForm); 
app.post('/auth', handleLogin)


app.use(
    '/jaeger', 
    createProxyMiddleware({
        target: JAEGER_URL, 
        changeOrigin: true, 
        pathRewrite: {'^/jaeger': ''}, 
        onError: (err, _req, res) => {
            console.error('Jaeger proxy error:', err); 
            if (typeof res.status === 'function') {
                res.status(502).send('Bad Gateway - Could not reach Jaeger.')
            }
        }
    })
); 


app.use(
    '/prometheus',
    requireAuth,
    createProxyMiddleware({
      target: PROMETHEUS_URL,
      changeOrigin: true,
      pathRewrite: { '^/prometheus': '' },
      onError: (err, _req, res) => {
        console.error('Prometheus proxy error:', err);
        if (typeof res.status === 'function') {
          res.status(502).send('Bad Gateway - Could not reach Prometheus');
        }
      }
    })
  );
  
  app.use(
    '/alertmanager',
    requireAuth,
    createProxyMiddleware({
      target: ALERTMANAGER_URL,
      changeOrigin: true,
      pathRewrite: { '^/alertmanager': '' },
      onError: (err, _req, res) => {
        console.error('AlertManager proxy error:', err);
        if (typeof res.status === 'function') {
          res.status(502).send('Bad Gateway - Could not reach AlertManager');
        }
      }
    })
  );
  
  // Start server
  const PORT = parseInt(process.env.PORT || '3001');
  
  app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Login:  http://localhost:${PORT}/auth`);
  }).on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  });