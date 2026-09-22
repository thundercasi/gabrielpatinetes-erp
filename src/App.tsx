import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './lib/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import { lazy } from 'react'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Vendas = lazy(() => import('./pages/Vendas'))
const Compras = lazy(() => import('./pages/Compras'))
const Estoque = lazy(() => import('./pages/Estoque'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const Clientes = lazy(() => import('./pages/Cadastros').then((m) => ({ default: m.Clientes })))
const Fornecedores = lazy(() => import('./pages/Cadastros').then((m) => ({ default: m.Fornecedores })))
const Produtos = lazy(() => import('./pages/Cadastros').then((m) => ({ default: m.Produtos })))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))

function Rotas() {
  const { session } = useApp()
  if (!session) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="compras" element={<Compras />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="fornecedores" element={<Fornecedores />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <AppProvider><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><Rotas /></BrowserRouter></AppProvider>
}
