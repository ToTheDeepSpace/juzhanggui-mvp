import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import CheckInPage from './pages/CheckInPage';
import EvaluationPage from './pages/EvaluationPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/checkin/:scheduleId" element={<CheckInPage />} />
        <Route path="/evaluate/:scheduleId" element={<EvaluationPage />} />
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
