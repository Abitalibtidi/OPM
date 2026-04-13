import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ValuationEditor from './pages/ValuationEditor';
import ValuationResults from './pages/ValuationResults';
import AuditLog from './pages/AuditLog';
import AdminUsers from './pages/AdminUsers';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/valuations/:id" element={<ValuationEditor />} />
        <Route path="/valuations/:id/results" element={<ValuationResults />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/admin/users" element={<AdminUsers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
