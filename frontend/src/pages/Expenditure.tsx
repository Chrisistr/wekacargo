import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { bookingsAPI } from '../services/api';
import { logout } from '../store/authSlice';
import { authAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

interface Booking {
  _id: string;
  origin: { address: string };
  destination: { address: string };
  cargoDetails: any;
  pricing: { estimatedAmount: number };
  status: string;
  createdAt: string;
}

const Expenditure: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

  const totalSpend = bookings.reduce(
    (sum, b) => sum + (b.pricing?.estimatedAmount || 0),
    0
  );

  const completedSpend = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (b.pricing?.estimatedAmount || 0), 0);

  const pendingSpend = bookings
    .filter(b => ['pending', 'confirmed', 'in-transit'].includes(b.status))
    .reduce((sum, b) => sum + (b.pricing?.estimatedAmount || 0), 0);

  const monthlySpend = bookings
    .filter(b => {
      const bookingDate = new Date(b.createdAt);
      const now = new Date();
      return bookingDate.getMonth() === now.getMonth() && 
             bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + (b.pricing?.estimatedAmount || 0), 0);


  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <h2 className="mb-0 fw-bold">Expenditure Overview</h2>
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" onClick={() => navigate('/dashboard/customer')}>
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        <Row className="mb-4 g-3">
          <Col md={3}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <Card.Body>
                <h6 className="text-uppercase mb-2" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Total Spend</h6>
                <h2 className="mb-0" style={{ fontSize: '2rem', fontWeight: 'bold' }}>KES {totalSpend.toLocaleString()}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  All time expenditure
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
              <Card.Body>
                <h6 className="text-uppercase mb-2" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Completed</h6>
                <h2 className="mb-0" style={{ fontSize: '2rem', fontWeight: 'bold' }}>KES {completedSpend.toLocaleString()}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  Completed deliveries
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <Card.Body>
                <h6 className="text-uppercase mb-2" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>Pending</h6>
                <h2 className="mb-0" style={{ fontSize: '2rem', fontWeight: 'bold' }}>KES {pendingSpend.toLocaleString()}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  Active bookings
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <Card.Body>
                <h6 className="text-uppercase mb-2" style={{ opacity: 0.9, fontSize: '0.75rem', letterSpacing: '1px' }}>This Month</h6>
                <h2 className="mb-0" style={{ fontSize: '2rem', fontWeight: 'bold' }}>KES {monthlySpend.toLocaleString()}</h2>
                <p className="mb-0 small mt-2" style={{ opacity: 0.85 }}>
                  Current month spend
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row>
          <Col>
            <Card className="dashboard-card" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <h4 className="mb-4">Expenditure Breakdown</h4>
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : bookings.length === 0 ? (
                  <p className="text-muted text-center py-5">No bookings found.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Route</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th className="text-end">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => (
                          <tr key={booking._id}>
                            <td>
                              {booking.origin.address} → {booking.destination.address}
                            </td>
                            <td>
                              {new Date(booking.createdAt).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </td>
                            <td>
                              <Badge bg={
                                booking.status === 'completed' ? 'success' :
                                booking.status === 'cancelled' ? 'danger' :
                                booking.status === 'in-transit' ? 'primary' :
                                booking.status === 'confirmed' ? 'info' : 'warning'
                              }>
                                {booking.status}
                              </Badge>
                            </td>
                            <td className="text-end fw-bold">
                              KES {booking.pricing.estimatedAmount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default Expenditure;

