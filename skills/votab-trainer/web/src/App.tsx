import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Review from './pages/Review';
import Learn from './pages/Learn';
import Status from './pages/Status';
import List from './pages/List';

function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <nav style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
          <Link to="/">复习</Link>
          <Link to="/learn">学习</Link>
          <Link to="/status">状态</Link>
          <Link to="/list">单词列表</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Review />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/status" element={<Status />} />
          <Route path="/list" element={<List />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
