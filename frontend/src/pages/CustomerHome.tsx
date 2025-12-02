import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Form } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI, notificationsAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

interface Booking {
  _id: string;
  origin: { address: string };
  destination: { address: string };
  cargoDetails: any;
  pricing: { estimatedAmount: number };
  status: string;
  createdAt: string;
  trucker?: { _id: string; name: string };
}

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedBooking?: { _id: string };
  relatedUser?: { name: string; email: string };
}

const CustomerHome: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const navigate = useNavigate();

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

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const response = await notificationsAPI.getAll();
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchBookings();
    fetchNotifications();
  }, [user, fetchBookings, fetchNotifications]);

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

  const pendingBookings = bookings.filter(b =>
    ['pending', 'confirmed'].includes(b.status)
  );

  // Filter only incomplete deliveries (pending, confirmed, in-transit)
  const incompleteBookings = bookings
    .filter(b => ['pending', 'confirmed', 'in-transit'].includes(b.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Get bookings with truckers for messaging
  const bookingsWithTruckers = bookings.filter(b => 
    b.trucker && ['pending', 'confirmed', 'in-transit'].includes(b.status)
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!selectedBooking) {
      toast.error('Please select a booking to message the trucker');
      return;
    }

    const booking = bookings.find(b => b._id === selectedBooking);
    if (!booking || !booking.trucker) {
      toast.error('Trucker information not available for this booking');
      return;
    }

    setSendingMessage(true);
    try {
      await notificationsAPI.sendMessage({
        truckerId: booking.trucker._id,
        bookingId: booking._id,
        message: newMessage
      });
      
      toast.success('Message sent to trucker');
      setNewMessage('');
      setSelectedBooking('');
      // Refresh notifications to show the sent message
      fetchNotifications();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
        <Row className="mb-4">
          <Col>
            <div>
              <h2 className="mb-1 fw-bold">Welcome, {user?.name}</h2>
              <p className="text-muted mb-0">
                Track your cargo, revisit past trips, and book new trucks in seconds.
              </p>
            </div>
          </Col>
        </Row>

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
            {/* Recent or Pending Bookings */}
            {loading ? (
              <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                <Card.Body>
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3 text-muted">Loading bookings...</p>
                </Card.Body>
              </Card>
            ) : incompleteBookings.length > 0 ? (
              <>
                <div className="d-flex align-items-center mb-3">
                  <h4 className="mb-0 me-3">Recent Activity</h4>
                  <Badge bg="warning" className="ms-2">Incomplete Deliveries</Badge>
                </div>
                {incompleteBookings.map((booking) => (
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
                ))}
                {incompleteBookings.length < bookings.filter(b => ['pending', 'confirmed', 'in-transit'].includes(b.status)).length && (
                  <div className="text-center mt-3">
                    <Button variant="outline-primary" onClick={() => navigate('/bookings')}>
                      View All Incomplete Deliveries
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
                <Card.Body>
                  <p className="mb-3 text-muted">You have no recent bookings.</p>
                  <Button variant="primary" onClick={() => navigate('/browse-trucks')}>
                    Browse Available Trucks
                  </Button>
                </Card.Body>
              </Card>
            )}
          </Col>
          <Col md={4} className="mt-4 mt-md-0">
            {/* Messages Section */}
            <Card className="dashboard-card mb-3" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h5 className="mb-0">Messages & Notifications</h5>
                  <div className="d-flex align-items-center gap-2">
                    {unreadCount > 0 && (
                      <>
                        <Badge bg="primary" className="ms-2">{unreadCount} unread</Badge>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 text-primary"
                          onClick={async () => {
                            try {
                              await notificationsAPI.markAllAsRead();
                              fetchNotifications();
                              toast.success('All notifications marked as read');
                            } catch (error) {
                              toast.error('Failed to mark all notifications as read');
                            }
                          }}
                        >
                          Mark all as read
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '15px' }}>
                  {notifications.length === 0 ? (
                    <p className="text-muted small text-center py-3">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 5).map((notif) => (
                      <div 
                        key={notif._id} 
                        className={`mb-2 p-2 ${!notif.read ? 'border-start border-primary border-3' : ''}`}
                        style={{ 
                          background: notif.read ? '#f8f9fa' : '#e7f3ff', 
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                        onClick={async () => {
                          if (!notif.read) {
                            try {
                              await notificationsAPI.markAsRead(notif._id);
                              fetchNotifications();
                            } catch (error) {
                              console.error('Failed to mark notification as read:', error);
                            }
                          }
                          if (notif.relatedBooking) {
                            navigate(`/booking/${notif.relatedBooking._id}`);
                          }
                        }}
                      >
                        <div className="d-flex justify-content-between mb-1">
                          <strong className="small">{notif.title}</strong>
                          <span className="small text-muted">
                            {new Date(notif.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="mb-0 small">{notif.message}</p>
                        {notif.type === 'message' && notif.relatedUser && (
                          <p className="mb-0 small text-muted mt-1">
                            From: {notif.relatedUser.name}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 5 && (
                  <Button 
                    variant="outline-primary" 
                    size="sm" 
                    className="w-100 mb-3"
                    onClick={() => navigate('/bookings')}
                  >
                    View All Notifications
                  </Button>
                )}
                
                {/* Send Message to Trucker */}
                <div className="border-top pt-3">
                  <h6 className="mb-2 small fw-bold">Message a Trucker</h6>
                  <Form onSubmit={handleSendMessage}>
                    <Form.Group className="mb-2">
                      <Form.Select
                        value={selectedBooking}
                        onChange={(e) => setSelectedBooking(e.target.value)}
                        size="sm"
                        required
                      >
                        <option value="">Select a booking...</option>
                        {bookingsWithTruckers.map((booking) => (
                          <option key={booking._id} value={booking._id}>
                            {booking.origin.address} → {booking.destination.address} ({booking.status})
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message to the trucker..."
                        style={{ fontSize: '0.9rem' }}
                        required
                      />
                    </Form.Group>
                    <Button 
                      type="submit" 
                      variant="primary" 
                      size="sm" 
                      className="w-100"
                      disabled={sendingMessage || !selectedBooking}
                    >
                      {sendingMessage ? 'Sending...' : 'Send Message'}
                    </Button>
                  </Form>
                </div>
              </Card.Body>
            </Card>

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
        </Container>
      </div>
    </div>
  );
};

export default CustomerHome;

