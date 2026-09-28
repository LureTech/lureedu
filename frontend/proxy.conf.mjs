// Proxy do "ng serve": /api e /files vão para a API publicada na Vercel (em São Paulo, ao lado do
// banco), que responde rápido mesmo quando a internet até o Supabase oscila.
// Para testar mudanças no servidor (server/), suba a API local e use: LURE_API=local
const local = process.env.LURE_API === 'local';
const target = local ? 'http://localhost:8085' : process.env.LURE_API || 'https://lureedu-seven.vercel.app';

export default {
  '/api': { target, secure: !local, changeOrigin: !local, logLevel: 'warn' },
  '/files': { target, secure: !local, changeOrigin: !local, logLevel: 'warn' },
};
