import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ModalProvider } from './components/ui/Modal';
import Review from './pages/Review';
import Learn from './pages/Learn';
import Status from './pages/Status';
import List from './pages/List';
const links = [
  { to: '/', label: '复习' },
  { to: '/learn', label: '学习' },
  { to: '/status', label: '状态' },
  { to: '/list', label: '单词' },
];

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`relative px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}>
      {label}
      {isActive && (
        <motion.div
          layoutId='nav-indicator'
          className='absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full'
          transition={{ duration: 0.2 }}
        />
      )}
    </Link>
  );
}

export default function App() {
  return (
    <ModalProvider>
      <BrowserRouter>
        <div className='min-h-[100dvh] bg-bg'>
          <nav className='sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border'>
            <div className='max-w-4xl mx-auto px-6 h-14 flex items-center justify-between'>
              <span className='text-base font-bold text-text-primary tracking-tight'>Vocab Trainer</span>
              <div className='flex items-center gap-1'>
                {links.map(l => <NavLink key={l.to} {...l} />)}
              </div>
            </div>
          </nav>
          <main className='max-w-4xl mx-auto px-6 py-8'>
            <Routes>
              <Route path='/' element={<Review />} />
              <Route path='/learn' element={<Learn />} />
              <Route path='/status' element={<Status />} />
              <Route path='/list' element={<List />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ModalProvider>
  );
}
