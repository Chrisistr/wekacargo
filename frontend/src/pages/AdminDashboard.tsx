import React, { useState, useEffect, useCallback } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import { toast } from 'react-toastify';
import { adminAPI } from '../services/api';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
const AdminDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const fetchStats = useCallback(async () => {
    try {
      const response = await adminAPI.getAnalytics();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics');
    }
  }, []);
  const fetchAlerts = useCallback(async () => {
    try {
      setLoadingAlerts(true);
      const response = await adminAPI.getAlerts({ status: 'open' });
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts');
    } finally {
      setLoadingAlerts(false);
    }
  }, []);
  const handleAlertStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
    try {
      await adminAPI.updateAlert(id, { status });
      toast.success('Alert updated');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };
  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
      return;
    }
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchStats();
    fetchAlerts();
  }, [user, navigate, fetchStats, fetchAlerts]);
  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="my-5" style={{ maxWidth: '100%' }}>
          <Row>
            <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="mb-1">Admin Control Center</h2>
              <p className="text-muted mb-0">
                Monitor platform health, manage users, and keep Kenya’s logistics network running smoothly.
              </p>
            </div>
          </div>
          {}
          <Row className="mb-4 g-3">
            <Col md={3}>
              <Card className="stats-card">
                <Card.Body>
                  <h6 className="text-uppercase small mb-1">Total Users</h6>
                  <h3 className="mb-0">{stats.users?.total || 0}</h3>
                  <p className="mb-0 small text-light opacity-75">
                    {stats.users?.truckers || 0} truckers • {stats.users?.customers || 0} customers
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="dashboard-card">
                <Card.Body>
                  <h6 className="text-muted text-uppercase small mb-1">Active Fleet</h6>
                  <h3 className="mb-0">{stats.trucks || 0}</h3>
                  <p className="mb-0 small text-muted">Total trucks onboarded on WekaCargo</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="dashboard-card">
                <Card.Body>
                  <h6 className="text-muted text-uppercase small mb-1">Bookings</h6>
                  <h3 className="mb-0">{stats.bookings?.total || 0}</h3>
                  <p className="mb-0 small text-muted">
                    {stats.bookings?.completed || 0} completed trips
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="dashboard-card">
                <Card.Body>
                  <h6 className="text-muted text-uppercase small mb-1">Total Revenue</h6>
                  <h3 className="mb-0">KES {(stats.revenue || 0).toLocaleString()}</h3>
                  <p className="mb-0 small text-muted">From completed, paid deliveries</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          {}
          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">User Alerts</h3>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => navigate('/admin/alerts')}
                >
                  View All Alerts
                </Button>
              </div>
              {loadingAlerts ? (
                <p>Loading alerts...</p>
              ) : alerts.length === 0 ? (
                <p className="text-muted">No open alerts from users.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Subject</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.slice(0, 5).map((a) => (
                        <tr key={a._id}>
                          <td>
                            {a.user?.name}
                            <br />
                            <small className="text-muted">
                              {a.user?.email} • {a.user?.role}
                            </small>
                          </td>
                          <td>{a.subject}</td>
                          <td style={{ maxWidth: '300px', wordWrap: 'break-word' }}>{a.message}</td>
                          <td>
                            <Badge bg={
                              a.status === 'resolved' ? 'success' :
                              a.status === 'in_progress' ? 'warning' : 'secondary'
                            }>
                              {a.status}
                            </Badge>
                          </td>
                          <td>{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => handleAlertStatus(a._id, 'in_progress')}
                              disabled={a.status === 'in_progress'}
                            >
                              In Progress
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleAlertStatus(a._id, 'resolved')}
                              disabled={a.status === 'resolved'}
                            >
                              Resolve
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {alerts.length > 5 && (
                    <div className="text-center mt-3">
                      <Button
                        variant="outline-primary"
                        onClick={() => navigate('/admin/alerts')}
                      >
                        View All {alerts.length} Alerts
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
        </Container>
      </div>
    </div>
  );
};
export default AdminDashboard;
