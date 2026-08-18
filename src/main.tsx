import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { forgetOtherProjects } from './lib/supabase'

// 移行前のプロジェクトのセッションが残っていれば片付ける。
forgetOtherProjects()

const root = document.getElementById('root')
if (root === null) throw new Error('#root が見つかりません')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
