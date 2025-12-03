import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Form, Nav } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingsAPI, alertsAPI, authAPI } from '../services/api';
import { logout } from '../store/authSlice';
interface Booking {
  _id: string;
  origin: { address: string };
  destination: { address: string };
  cargoDetails: any;
  pricing: { estimatedAmount: number };
  status: string;
  createdAt: string;
}
const CustomerDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertSubject, setAlertSubject] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === '/expenditure') {
      setActiveTab('expenditure');
    } else if (location.pathname === '/bookings') {
      setActiveTab('bookings');
    } else if (location.pathname === '/raise-issue') {
      setActiveTab('raise-issue');
    } else if (location.pathname === '/home') {
      setActiveTab('home');
    } else if (location.pathname === '/dashboard/customer') {
      setActiveTab('home');
    } else {
      setActiveTab('home');
    }
  }, [location]);
  const fetchBookings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const response = await bookingsAPI.getMyBookings();
      setBookings(response.data);
    } catch (error) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchBookings();
  }, [user, fetchBookings]);
  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'warning',
      confirmed: 'info',
      'in-transit': 'primary',
      completed: 'success',
      cancelled: 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };
  const totalSpend = bookings.reduce(
    (sum, b) => sum + (b.pricing?.estimatedAmount || 0),
    0
  );
  const activeCount = bookings.filter(b =>
    ['confirmed', 'in-transit'].includes(b.status)
  ).length;
  const handleAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!alertSubject.trim() || !alertMessage.trim()) {
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
    }
  };
  const handleLogout = async () => {
    try {
      if (user) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      dispatch(logout());
      navigate('/');
    }
  };
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'expenditure') {
      navigate('/expenditure');
    } else if (tab === 'bookings') {
      navigate('/bookings');
    } else if (tab === 'raise-issue') {
      navigate('/raise-issue');
    } else if (tab === 'home') {
      navigate('/home');
    } else {
      navigate('/dashboard/customer');
    }
  };
  if (location.pathname === '/expenditure' || location.pathname === '/home' || location.pathname === '/bookings' || location.pathname === '/raise-issue') {
    return null; 
  }
  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Container className="py-4">
        {}
        <Card className="mb-4" style={{ border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <Card.Body className="p-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 3px 10px rgba(0,0,0,0.2)', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {user?.profile?.avatar ? (
                    <img 
                      src={user.profile.avatar} 
                      alt={user?.name || 'User'} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.textContent = user?.name?.charAt(0).toUpperCase() || 'U';
                        }
                      }}
                    />
                  ) : (
                    user?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div>
                  <h5 className="mb-0 fw-bold">Welcome, {user?.name}</h5>
                  <p className="text-muted mb-0 small">Customer Dashboard</p>
                </div>
              </div>
              <Nav className="d-flex gap-2 flex-wrap">
                <Button 
                  variant={activeTab === 'home' ? 'primary' : 'outline-primary'} 
                  size="sm"
                  onClick={() => handleTabChange('home')}
                >
                  Home
                </Button>
                <Button 
                  variant={activeTab === 'bookings' ? 'primary' : 'outline-primary'} 
                  size="sm"
                  onClick={() => handleTabChange('bookings')}
                >
                  Bookings
                </Button>
                <Button 
                  variant={activeTab === 'raise-issue' ? 'primary' : 'outline-primary'} 
                  size="sm"
                  onClick={() => handleTabChange('raise-issue')}
                >
                  Raise an Issue
                </Button>
                <Button 
                  variant={activeTab === 'expenditure' ? 'primary' : 'outline-primary'} 
                  size="sm"
                  onClick={() => handleTabChange('expenditure')}
                >
                  Expenditure
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  Settings
                </Button>
                <Button 
                  variant="outline-danger" 
                  size="sm"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => navigate('/browse-trucks')}
                >
                  Book a New Truck
                </Button>
              </Nav>
            </div>
          </Card.Body>
        </Card>
        <Row className="mb-4 g-3">
          <Col md={4}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <Card.Body>
                <div className="d-flex align-items-center mb-2">
                  <h6 className="text-uppercase mb-0" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Total Trips</h6>
                </div>
                <h2 className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{bookings.length}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  All bookings you have ever made on WekaCargo.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <Card.Body>
                <div className="d-flex align-items-center mb-2">
                  <h6 className="text-uppercase mb-0" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Active Deliveries</h6>
                </div>
                <h2 className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{activeCount}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  Deliveries currently confirmed or in transit.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <Card.Body>
                <div className="d-flex align-items-center mb-2">
                  <h6 className="text-uppercase mb-0" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Total Spend</h6>
                </div>
                <h2 className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>KES {totalSpend.toLocaleString()}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  Estimated value across all your completed bookings.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        {}
        {activeTab === 'home' && (
          <>
            <Row className="mb-4 g-3">
              <Col md={4}>
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase mb-0" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Total Trips</h6>
                    </div>
                    <h2 className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{bookings.length}</h2>
                    <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                      All bookings you have ever made on WekaCargo.
                    </p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase mb-0" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Active Deliveries</h6>
                    </div>
                    <h2 className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{activeCount}</h2>
                    <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                      Deliveries currently confirmed or in transit.
                    </p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase mb-0" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Total Spend</h6>
                    </div>
                    <h2 className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>KES {totalSpend.toLocaleString()}</h2>
                    <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                      Estimated value across all your completed bookings.
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            <Row>
              <Col md={8}>
                <div className="d-flex align-items-center mb-3">
                  <h4 className="mb-0 me-3">Recent Bookings</h4>
                  <span className="badge bg-info">{bookings.length} total</span>
                </div>
            {loading ? (
              <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                <Card.Body>
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Loading bookings...</p>
                </Card.Body>
              </Card>
            ) : bookings.length === 0 ? (
              <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                <Card.Body>
                  <p className="mb-3 text-muted">You have no bookings yet.</p>
                  <Button variant="primary" onClick={() => navigate('/browse-trucks')}>
                    Browse Available Trucks
                  </Button>
                </Card.Body>
              </Card>
            ) : (
              bookings.slice(0, 5).map((booking) => (
                <Card key={booking._id} className="mb-3 card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                  <Card.Body>
                    <Row className="align-items-center">
                      <Col md={8}>
                        <div className="d-flex align-items-center mb-2">
                          <h5 className="mb-0 me-2">
                            {booking.origin.address} → {booking.destination.address}
                          </h5>
                          {getStatusBadge(booking.status)}
                        </div>
                        <p className="text-muted mb-2 small">
                          <strong>Booking Date:</strong> {new Date(booking.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                        {booking.cargoDetails && (
                          <p className="text-muted mb-1 small">
                            <strong>Cargo:</strong> {booking.cargoDetails.type} • {booking.cargoDetails.weight} tons
                          </p>
                        )}
                        <p className="mb-0">
                          <strong style={{ color: '#667eea', fontSize: '1.1rem' }}>
                            KES {booking.pricing.estimatedAmount.toLocaleString()}
                          </strong>
                        </p>
                      </Col>
                      <Col
                        md={4}
                        className="text-md-end mt-3 mt-md-0 d-flex align-items-center justify-content-md-end justify-content-start gap-2"
                      >
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => navigate(`/booking/${booking._id}`)}
                        >
                          View Details
                        </Button>
                        {booking.status === 'in-transit' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/tracking/${booking._id}`)}
                          >
                            Track
                          </Button>
                        )}
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              ))
            )}
                {bookings.length > 5 && (
                  <div className="text-center mt-3">
                    <Button variant="outline-primary" onClick={() => handleTabChange('bookings')}>
                      View All Bookings ({bookings.length})
                    </Button>
                  </div>
                )}
              </Col>
              <Col md={4} className="mt-4 mt-md-0">
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-3">
                      <h5 className="mb-0">Tips for Cheaper Deliveries</h5>
                    </div>
                    <ul className="mb-0 small text-muted" style={{ listStyle: 'none', paddingLeft: '0' }}>
                      <li className="mb-2" style={{ paddingLeft: '24px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                        Book off-peak hours to get more competitive truck rates.
                      </li>
                      <li className="mb-2" style={{ paddingLeft: '24px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                        Combine shipments going to the same route to save on per-trip charges.
                      </li>
                      <li className="mb-0" style={{ paddingLeft: '24px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0', color: '#667eea' }}>•</span>
                        Keep your pick-up and drop-off locations accurate for better matching.
                      </li>
                    </ul>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
        {activeTab === 'bookings' && (
          <Row>
            <Col>
              <div className="d-flex align-items-center mb-3">
                <h4 className="mb-0 me-3">My Bookings</h4>
                <span className="badge bg-info">{bookings.length} total</span>
              </div>
              {loading ? (
                <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                  <Card.Body>
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Loading bookings...</p>
                  </Card.Body>
                </Card>
              ) : bookings.length === 0 ? (
                <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                  <Card.Body>
                    <p className="mb-3 text-muted">You have no bookings yet.</p>
                    <Button variant="primary" onClick={() => navigate('/browse-trucks')}>
                      Browse Available Trucks
                    </Button>
                  </Card.Body>
                </Card>
              ) : (
                bookings.map((booking) => (
                  <Card key={booking._id} className="mb-3 card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                    <Card.Body>
                      <Row className="align-items-center">
                        <Col md={8}>
                          <div className="d-flex align-items-center mb-2">
                            <h5 className="mb-0 me-2">
                              {booking.origin.address} → {booking.destination.address}
                            </h5>
                            {getStatusBadge(booking.status)}
                          </div>
                          <p className="text-muted mb-2 small">
                            <strong>Booking Date:</strong> {new Date(booking.createdAt).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                          {booking.cargoDetails && (
                            <p className="text-muted mb-1 small">
                              <strong>Cargo:</strong> {booking.cargoDetails.type} • {booking.cargoDetails.weight} tons
                            </p>
                          )}
                          <p className="mb-0">
                            <strong style={{ color: '#667eea', fontSize: '1.1rem' }}>
                              KES {booking.pricing.estimatedAmount.toLocaleString()}
                            </strong>
                          </p>
                        </Col>
                        <Col
                          md={4}
                          className="text-md-end mt-3 mt-md-0 d-flex align-items-center justify-content-md-end justify-content-start gap-2"
                        >
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(`/booking/${booking._id}`)}
                          >
                            View Details
                          </Button>
                          {booking.status === 'in-transit' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/tracking/${booking._id}`)}
                            >
                              Track
                            </Button>
                          )}
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))
              )}
            </Col>
          </Row>
        )}
        {activeTab === 'raise-issue' && (
          <Row>
            <Col md={8}>
              <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                <Card.Body>
                  <div className="d-flex align-items-center mb-3">
                    <h4 className="mb-0">Raise an Issue</h4>
                  </div>
                  <p className="text-muted mb-4">
                    Experiencing a problem with a booking or trucker? Send a quick alert directly to the admin team.
                  </p>
                  <Form onSubmit={handleAlertSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Subject</Form.Label>
                      <Form.Control
                        type="text"
                        value={alertSubject}
                        onChange={(e) => setAlertSubject(e.target.value)}
                        placeholder="e.g. Delayed delivery, payment issue"
                        required
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Details</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={5}
                        value={alertMessage}
                        onChange={(e) => setAlertMessage(e.target.value)}
                        placeholder="Describe what happened so we can assist quickly."
                        required
                      />
                    </Form.Group>
                    <div className="text-end">
                      <Button type="submit" variant="primary">
                        Send Alert
                      </Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </div>
  );
};
export default CustomerDashboard;
