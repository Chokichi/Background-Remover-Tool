import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StackingProvider } from './context/StackingContext'
import { BackgroundRemoverProvider } from './context/BackgroundRemoverContext'
import BackgroundRemover from './pages/BackgroundRemover'
import StackingView from './pages/StackingView'
import JCAMPDXEditor from './pages/JCAMPDXEditor'
import './App.css'

export default function App() {
  return (
    <StackingProvider>
      <BackgroundRemoverProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<StackingView />} />
            <Route path="/background-remover" element={<BackgroundRemover />} />
            <Route path="/jcamp-editor" element={<JCAMPDXEditor />} />
          </Routes>
        </BrowserRouter>
      </BackgroundRemoverProvider>
    </StackingProvider>
  )
}
