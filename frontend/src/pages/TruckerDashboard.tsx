import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { bookingsAPI, trucksAPI, notificationsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

interface Booking {
  _id: string;
  customer: { name: string; phone: string; profile?: { avatar?: string } };
  origin: { address: string };
  destination: { address: string };
  cargoDetails: any;
  pricing: { estimatedAmount: number };
  status: string;
  createdAt: string;
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

const TruckerDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const userId = user?.id || (user as any)?._id || '';
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myTrucks, setMyTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const belongsToCurrentUser = useCallback(
    (truck: any) => {
      if (!userId) return false;
      const trucker = truck?.trucker;
      const truckerId =
        typeof trucker === 'string'
          ? trucker
          : trucker?._id || trucker?.id;
      return truckerId?.toString() === userId;
    },
    [userId]
  );

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

  const fetchTrucks = useCallback(async () => {
    if (!user) return;
    try {
      const response = await trucksAPI.getAll();
      setMyTrucks(response.data.filter((t: any) => belongsToCurrentUser(t)));
    } catch (error) {
      console.error('Failed to fetch trucks');
    }
  }, [user, belongsToCurrentUser]);

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
    fetchTrucks();
    fetchNotifications();
  }, [user, fetchBookings, fetchTrucks, fetchNotifications]);

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await bookingsAPI.update(bookingId, { status: newStatus });
      toast.success('Booking status updated');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const activeBookings = bookings.filter(b =>
    ['confirmed', 'in-transit'].includes(b.status)
  );
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalEarnings = bookings.reduce(
    (sum, b) => sum + (b.pricing?.estimatedAmount || 0),
    0
  );

  const unreadCount = notifications.filter(n => !n.read).length;

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

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
        <Row>
          <Col>
            <div className="mb-4">
              <h2 className="mb-1 fw-bold">Welcome, {user?.name}</h2>
              <p className="text-muted mb-0">
                Manage your vehicles, track bookings, and grow your earnings across Kenya.
              </p>
            </div>
          
            <Row className="mb-4 g-3">
              <Col md={3}>
                <Card className="stats-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase small mb-0" style={{ opacity: 0.9, fontSize: '0.7rem', letterSpacing: '1px' }}>Active Bookings</h6>
                    </div>
                    <h3 className="mb-0" style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{activeBookings.length}</h3>
                    <p className="mb-0 small text-light opacity-75">Confirmed & in-transit loads</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase small mb-0" style={{ opacity: 0.9, fontSize: '0.7rem', letterSpacing: '1px' }}>Completed Trips</h6>
                    </div>
                    <h3 className="mb-0" style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{completedBookings.length}</h3>
                    <p className="mb-0 small" style={{ opacity: 0.85 }}>Successfully delivered cargo</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase small mb-0" style={{ opacity: 0.9, fontSize: '0.7rem', letterSpacing: '1px' }}>Fleet Size</h6>
                    </div>
                    <h3 className="mb-0" style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{myTrucks.length}</h3>
                    <p className="mb-0 small" style={{ opacity: 0.85 }}>Vehicles registered on WekaCargo</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center mb-2">
                      <h6 className="text-uppercase small mb-0" style={{ opacity: 0.9, fontSize: '0.7rem', letterSpacing: '1px' }}>Estimated Earnings</h6>
                    </div>
                    <h3 className="mb-0" style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>KES {totalEarnings.toLocaleString()}</h3>
                    <p className="mb-0 small" style={{ opacity: 0.85 }}>From all completed & active bookings</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

          {/* New Delivery Requests (Pending Bookings) */}
          {!loading && bookings.filter(b => b.status === 'pending').length > 0 && (
            <Row className="mb-4">
              <Col>
                <div className="d-flex align-items-center mb-3">
                  <h3 className="mb-0 me-3">New Delivery Requests</h3>
                  <Badge bg="warning" style={{ fontSize: '1rem', padding: '8px 15px' }}>
                    {bookings.filter(b => b.status === 'pending').length} pending
                  </Badge>
                </div>
                <Row className="g-3">
                  {bookings.filter(b => b.status === 'pending').map((booking) => (
                    <Col key={booking._id} md={6}>
                      <Card className="card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', height: '100%' }}>
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center">
                              <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                marginRight: '12px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                flexShrink: 0
                              }}>
                                {(booking.customer as any)?.profile?.avatar ? (
                                  <img 
                                    src={(booking.customer as any).profile.avatar} 
                                    alt={booking.customer.name || 'Customer'} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.textContent = booking.customer.name?.charAt(0).toUpperCase() || 'C';
                                      }
                                    }}
                                  />
                                ) : (
                                  booking.customer.name?.charAt(0).toUpperCase() || 'C'
                                )}
                              </div>
                              <div>
                                <h6 className="mb-1">{booking.customer.name}</h6>
                                <p className="text-muted small mb-0">{booking.customer.phone}</p>
                              </div>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>
                          
                          <div className="mb-3">
                            <p className="mb-1">
                              <strong>Route:</strong> {booking.origin.address} → {booking.destination.address}
                            </p>
                            {booking.cargoDetails && (
                              <p className="mb-1 small text-muted">
                                <strong>Cargo:</strong> {booking.cargoDetails.type} • {booking.cargoDetails.weight} tons
                              </p>
                            )}
                            <p className="mb-0">
                              <strong style={{ color: '#667eea', fontSize: '1.1rem' }}>
                                KES {booking.pricing.estimatedAmount.toLocaleString()}
                              </strong>
                            </p>
                          </div>

                          <div className="d-flex gap-2 flex-wrap">
                            <Button 
                              size="sm" 
                              variant="success"
                              onClick={() => updateBookingStatus(booking._id, 'confirmed')}
                            >
                              Accept Booking
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => navigate(`/booking/${booking._id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Col>
            </Row>
          )}

          {/* Undelivered (Confirmed & In-Transit Bookings) */}
          {!loading && activeBookings.length > 0 && (
            <Row className="mb-4">
              <Col>
                <div className="d-flex align-items-center mb-3">
                  <h3 className="mb-0 me-3">Undelivered</h3>
                  <Badge bg="primary" style={{ fontSize: '1rem', padding: '8px 15px' }}>
                    {activeBookings.length} active
                  </Badge>
                </div>
                <Row className="g-3">
                  {activeBookings.map((booking) => (
                    <Col key={booking._id} md={6}>
                      <Card className="card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', height: '100%' }}>
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center">
                              <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                marginRight: '12px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                flexShrink: 0
                              }}>
                                {(booking.customer as any)?.profile?.avatar ? (
                                  <img 
                                    src={(booking.customer as any).profile.avatar} 
                                    alt={booking.customer.name || 'Customer'} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.textContent = booking.customer.name?.charAt(0).toUpperCase() || 'C';
                                      }
                                    }}
                                  />
                                ) : (
                                  booking.customer.name?.charAt(0).toUpperCase() || 'C'
                                )}
                              </div>
                              <div>
                                <h6 className="mb-1">{booking.customer.name}</h6>
                                <p className="text-muted small mb-0">{booking.customer.phone}</p>
                              </div>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>
                          
                          <div className="mb-3">
                            <p className="mb-1">
                              <strong>Route:</strong> {booking.origin.address} → {booking.destination.address}
                            </p>
                            {booking.cargoDetails && (
                              <p className="mb-1 small text-muted">
                                <strong>Cargo:</strong> {booking.cargoDetails.type} • {booking.cargoDetails.weight} tons
                              </p>
                            )}
                            <p className="mb-0">
                              <strong style={{ color: '#667eea', fontSize: '1.1rem' }}>
                                KES {booking.pricing.estimatedAmount.toLocaleString()}
                              </strong>
                            </p>
                          </div>

                          <div className="d-flex gap-2 flex-wrap">
                            {booking.status === 'confirmed' && (
                              <Button 
                                size="sm" 
                                variant="primary"
                                onClick={() => updateBookingStatus(booking._id, 'in-transit')}
                              >
                                Start Transit
                              </Button>
                            )}
                            {booking.status === 'in-transit' && (
                              <Button 
                                size="sm" 
                                variant="success"
                                onClick={() => updateBookingStatus(booking._id, 'completed')}
                              >
                                Mark Complete
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline-primary"
                              onClick={() => navigate(`/booking/${booking._id}`)}
                            >
                              View Details
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Col>
            </Row>
          )}

          {!loading && bookings.filter(b => b.status === 'pending').length === 0 && activeBookings.length === 0 && (
            <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <p className="text-muted">No new delivery requests or undelivered bookings at the moment.</p>
              </Card.Body>
            </Card>
          )}
        </Col>
        <Col md={3} className="mt-4 mt-md-0">
          {/* Messages & Notifications Section */}
          <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
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
                <div className="text-center">
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => {
                      // Navigate to a full notifications page if it exists, or just show all
                      // For now, we'll just show a message
                      toast.info('View all notifications feature coming soon');
                    }}
                  >
                    View All
                  </Button>
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

export default TruckerDashboard;

