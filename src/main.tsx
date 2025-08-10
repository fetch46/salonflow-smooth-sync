import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SaasProvider } from '@/lib/saas'

createRoot(document.getElementById("root")!).render(
  <SaasProvider>
    <App />
  </SaasProvider>
);
