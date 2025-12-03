import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { adminAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

const AdminTruckRemoval: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [removalRequests, setRemovalRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRemovalRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getRemovalRequests({ status: 'pending' });
      setRemovalRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch removal requests');
      toast.error('Failed to fetch removal requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchRemovalRequests();
    }
  }, [user, fetchRemovalRequests]);

  const handleRemovalAction = async (id: string) => {
    try {
      await adminAPI.updateRemovalRequest(id, {});
      toast.success('Removal request approved');
      fetchRemovalRequests();
    } catch (error) {
      toast.error('Failed to approve removal request');
    }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <h2 className="mb-1 fw-bold">Truck Removal Requests</h2>
              <p className="text-muted mb-0">Review and approve truck removal requests from truckers</p>
            </Col>
          </Row>

          <Card className="mb-4">
            <Card.Body>
              {loading ? (
                <p>Loading...</p>
              ) : removalRequests.length === 0 ? (
                <p className="text-muted">No pending removal requests.</p>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Trucker Details</th>
                      <th>Truck Details</th>
                      <th>Reason</th>
                      <th>Requested At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {removalRequests.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <strong>{r.trucker?.name}</strong>
                          <br />
                          <small className="text-muted">
                            Phone: {r.trucker?.phone}
                            <br />
                            Email: {r.trucker?.email}
                            {r.trucker?.location?.address && (
                              <>
                                <br />
                                Location: {r.trucker.location.address}
                              </>
                            )}
                            {r.trucker?.rating && (
                              <>
                                <br />
                                Rating: {r.trucker.rating.average?.toFixed(1) || 0} ({r.trucker.rating.count || 0} reviews)
                              </>
                            )}
                          </small>
                        </td>
                        <td>
                          <strong>{r.truck?.type?.toUpperCase()}</strong>
                          <br />
                          <small className="text-muted">
                            Registration: {r.truck?.registrationNumber}
                            {r.truck?.capacity?.weight && (
                              <>
                                <br />
                                Capacity: {r.truck.capacity.weight} tons
                              </>
                            )}
                            {r.truck?.rates?.perKm && (
                              <>
                                <br />
                                Rate: KES {r.truck.rates.perKm}/km
                              </>
                            )}
                            {r.truck?.location?.address && (
                              <>
                                <br />
                                Location: {r.truck.location.address}
                              </>
                            )}
                            {r.truck?.availability && (
                              <>
                                <br />
                                {r.truck.availability.isAvailable ? (
                                  <Badge bg="success">Available</Badge>
                                ) : (
                                  <Badge bg="danger">Unavailable</Badge>
                                )}
                              </>
                            )}
                          </small>
                        </td>
                        <td>{r.reason}</td>
                        <td>{new Date(r.createdAt).toLocaleString()}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleRemovalAction(r._id)}
                            disabled={r.status === 'approved'}
                          >
                            {r.status === 'approved' ? 'Approved' : 'Approve'}
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

export default AdminTruckRemoval;




