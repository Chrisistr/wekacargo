import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { adminAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

const AdminUserAlerts: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAlerts({ status: 'open' });
      setAlerts(response.data);
    } catch (error) {
      console.error('Failed to fetch alerts');
      toast.error('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAlerts();
    }
  }, [user, fetchAlerts]);

  const handleAlertStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
    try {
      await adminAPI.updateAlert(id, { status });
      toast.success('Alert updated');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to update alert');
    }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <h2 className="mb-1 fw-bold">User Alerts</h2>
              <p className="text-muted mb-0">Review and manage alerts and issues reported by users</p>
            </Col>
          </Row>

          <Card className="mb-4">
            <Card.Body>
              {loading ? (
                <p>Loading...</p>
              ) : alerts.length === 0 ? (
                <p className="text-muted">No open alerts from users.</p>
              ) : (
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
                    {alerts.map((a) => (
                      <tr key={a._id}>
                        <td>
                          {a.user?.name}
                          <br />
                          <small className="text-muted">
                            {a.user?.email} • {a.user?.role}
                          </small>
                        </td>
                        <td>{a.subject}</td>
                        <td>{a.message}</td>
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
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>
    </div>
  );
};

export default AdminUserAlerts;




