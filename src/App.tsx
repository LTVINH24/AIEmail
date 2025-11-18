import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InboxPage } from './pages/InboxPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/" element={<Navigate to="/inbox" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
