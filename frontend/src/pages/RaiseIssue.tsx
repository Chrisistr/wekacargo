import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Form } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { alertsAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

const RaiseIssue: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [alertSubject, setAlertSubject] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!alertSubject.trim() || !alertMessage.trim()) {
        toast.error('Please fill in all fields');
        setLoading(false);
        return;
      }
      await alertsAPI.create({
        subject: alertSubject.trim(),
        message: alertMessage.trim(),
      });
      toast.success('Alert sent to admin. We will review and get back to you.');
      setAlertSubject('');
      setAlertMessage('');
    } catch (error) {
      toast.error('Failed to send alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      {(user?.role === 'customer' || user?.role === 'trucker') && <Sidebar />}
      <div style={{ marginLeft: (user?.role === 'customer' || user?.role === 'trucker') ? '250px' : '0', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h2 className="mb-1 fw-bold">Raise an Issue</h2>
                <p className="text-muted mb-0">
                  Report problems with bookings or truckers directly to our admin team
                </p>
              </div>
              <Button variant="outline-secondary" onClick={() => navigate('/dashboard/customer')}>
                Back to Dashboard
              </Button>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <p className="text-muted mb-4">
                  Experiencing a problem with a booking or trucker? Send a quick alert directly to the admin team. 
                  We'll review your issue and get back to you as soon as possible.
                </p>
                <Form onSubmit={handleAlertSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Subject</Form.Label>
                    <Form.Control
                      type="text"
                      value={alertSubject}
                      onChange={(e) => setAlertSubject(e.target.value)}
                      placeholder="e.g. Delayed delivery, payment issue, driver behavior"
                      required
                    />
                    <Form.Text className="text-muted">
                      Briefly describe the type of issue you're experiencing
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Details</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={8}
                      value={alertMessage}
                      onChange={(e) => setAlertMessage(e.target.value)}
                      placeholder="Describe what happened, when it occurred, and any relevant booking details so we can assist quickly."
                      required
                    />
                    <Form.Text className="text-muted">
                      Provide as much detail as possible to help us resolve your issue faster
                    </Form.Text>
                  </Form.Group>
                  <div className="d-flex gap-2">
                    <Button type="submit" variant="primary" disabled={loading}>
                      {loading ? 'Sending...' : 'Send Alert'}
                    </Button>
                    <Button type="button" variant="outline-secondary" onClick={() => {
                      setAlertSubject('');
                      setAlertMessage('');
                    }}>
                      Clear
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <h5 className="mb-3">What can we help with?</h5>
                <ul className="mb-0 small text-muted" style={{ listStyle: 'none', paddingLeft: '0' }}>
                  <li className="mb-2" style={{ paddingLeft: '24px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                    Delayed or missing deliveries
                  </li>
                  <li className="mb-2" style={{ paddingLeft: '24px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                    Payment or billing issues
                  </li>
                  <li className="mb-2" style={{ paddingLeft: '24px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                    Driver or trucker behavior concerns
                  </li>
                  <li className="mb-2" style={{ paddingLeft: '24px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                    Booking cancellation requests
                  </li>
                  <li className="mb-0" style={{ paddingLeft: '24px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                    Technical issues with the platform
                  </li>
                </ul>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        </Container>
      </div>
    </div>
  );
};

export default RaiseIssue;

