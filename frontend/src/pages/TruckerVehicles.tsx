import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Image } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { trucksAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
const TruckerVehicles: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const userId = user?.id || (user as any)?._id || '';
  const navigate = useNavigate();
  const [myTrucks, setMyTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [selectedTruck, setSelectedTruck] = useState<any | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    type: 'pickup',
    capacity: '',
    registrationNumber: '',
    perKm: '',
    minimumCharge: '',
    address: '',
    photos: [''],
    isAvailable: true,
    proofOfOwnership: ''
  });
  const [updatingTruck, setUpdatingTruck] = useState(false);
  const belongsToCurrentUser = useCallback(
    (truck: any) => {
      if (!userId) return false;
      const trucker = truck?.trucker;
      const truckerId =
        typeof trucker === 'string'
          ? trucker
          : (trucker as any)?._id || (trucker as any)?.id;
      return truckerId?.toString() === userId;
    },
    [userId]
  );
  const fetchTrucks = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await trucksAPI.getAll();
      setMyTrucks(response.data.filter((t: any) => belongsToCurrentUser(t)));
    } catch (error) {
      toast.error('Failed to fetch trucks');
    } finally {
      setLoading(false);
    }
  }, [user, belongsToCurrentUser]);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTrucks();
  }, [user, fetchTrucks]);
  const openRemovalModal = (truck: any) => {
    setSelectedTruck(truck);
    setRemovalReason('');
    setShowRemovalModal(true);
  };
  const openEditModal = (truck: any) => {
    setEditingTruck(truck);
    setEditForm({
      type: truck.type || 'pickup',
      capacity: truck.capacity?.weight?.toString() || '',
      registrationNumber: truck.registrationNumber || '',
      perKm: truck.rates?.perKm?.toString() || '',
      minimumCharge: truck.rates?.minimumCharge?.toString() || '',
      address: truck.location?.address || '',
      photos: truck.photos && truck.photos.length > 0 ? truck.photos : [''],
      isAvailable: truck.availability?.isAvailable !== false,
      proofOfOwnership: truck.proofOfOwnership || ''
    });
    setShowEditModal(true);
  };
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTruck) return;
    try {
      setUpdatingTruck(true);
      const payload: any = {
        type: editForm.type,
        capacity: { weight: parseFloat(editForm.capacity) },
        registrationNumber: editForm.registrationNumber,
        rates: {
          perKm: parseFloat(editForm.perKm),
          minimumCharge: parseFloat(editForm.minimumCharge)
        },
        location: {
          address: editForm.address
        },
        photos: editForm.photos.filter((url) => url.trim() !== ''),
        availability: {
          isAvailable: editForm.isAvailable
        }
      };
      if (editForm.proofOfOwnership) {
        payload.proofOfOwnership = editForm.proofOfOwnership;
      }
      await trucksAPI.update(editingTruck._id, payload);
      toast.success('Truck updated successfully');
      setShowEditModal(false);
      fetchTrucks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update truck');
    } finally {
      setUpdatingTruck(false);
    }
  };
  const handleEditPhotoChange = (index: number, value: string) => {
    const updatedPhotos = [...editForm.photos];
    updatedPhotos[index] = value;
    setEditForm({ ...editForm, photos: updatedPhotos });
  };
  const handleSubmitRemoval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck) return;
    try {
      if (!removalReason.trim()) {
        toast.warn('Please provide a reason for removal.');
        return;
      }
      await trucksAPI.requestRemoval(selectedTruck._id, { reason: removalReason.trim() });
      toast.success('Removal request submitted for admin review.');
      setShowRemovalModal(false);
      fetchTrucks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit removal request');
    }
  };
  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold">My Vehicles</h2>
                  <p className="text-muted mb-0">Manage your registered vehicles</p>
                </div>
                <Button variant="primary" onClick={() => navigate('/trucker/add-vehicle')}>
                  Add New Vehicle
                </Button>
              </div>
            </Col>
          </Row>
          {loading ? (
            <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 text-muted">Loading vehicles...</p>
              </Card.Body>
            </Card>
          ) : myTrucks.length === 0 ? (
            <Card className="text-center py-5" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
              <Card.Body>
                <p className="text-muted mb-3">No vehicles registered yet.</p>
                <Button variant="primary" onClick={() => navigate('/trucker/add-vehicle')}>
                  Add Your First Vehicle
                </Button>
              </Card.Body>
            </Card>
          ) : (
            <Row className="g-3">
              {myTrucks.map((truck) => (
                <Col key={truck._id} md={4}>
                  <Card className="card-hover" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {truck.photos && truck.photos.length > 0 ? (
                      <div style={{ height: '200px', overflow: 'hidden' }}>
                        <img
                          src={truck.photos[0]}
                          alt={truck.type}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div style={{ height: '200px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      </div>
                    )}
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <Card.Title className="mb-0">{truck.type.toUpperCase()}</Card.Title>
                        <Badge bg={truck.availability?.isAvailable ? 'success' : 'danger'}>
                          {truck.availability?.isAvailable ? 'Available' : 'Occupied'}
                        </Badge>
                      </div>
                      <div className="mb-2">
                        <small className="text-muted d-block">Capacity: <strong>{truck.capacity?.weight} tons</strong></small>
                        <small className="text-muted d-block">Rate: <strong>KES {truck.rates?.perKm}/km</strong></small>
                        <small className="text-muted d-block">Location: <strong>{truck.location?.address || 'N/A'}</strong></small>
                      </div>
                      <div className="mt-3 d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => openEditModal(truck)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => openRemovalModal(truck)}
                        >
                          Request Removal
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
          {}
          <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
            <Form onSubmit={handleEditSubmit}>
              <Modal.Header closeButton>
                <Modal.Title>Edit Vehicle</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Vehicle Type</Form.Label>
                      <Form.Select
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      >
                        <option value="pickup">Pickup</option>
                        <option value="lorry">Lorry</option>
                        <option value="truck">Truck</option>
                        <option value="container">Container</option>
                        <option value="flatbed">Flatbed</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Capacity (tons)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.1"
                        value={editForm.capacity}
                        onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Registration Number</Form.Label>
                      <Form.Control
                        type="text"
                        value={editForm.registrationNumber}
                        onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Rate per KM (KES)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={editForm.perKm}
                        onChange={(e) => setEditForm({ ...editForm, perKm: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Minimum Charge (KES)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={editForm.minimumCharge}
                        onChange={(e) => setEditForm({ ...editForm, minimumCharge: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Base Location</Form.Label>
                      <Form.Control
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Check
                        type="checkbox"
                        label="Available for bookings"
                        checked={editForm.isAvailable}
                        onChange={(e) => setEditForm({ ...editForm, isAvailable: e.target.checked })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Vehicle Photos</Form.Label>
                      {editForm.photos.map((url, index) => (
                        <Form.Control
                          key={index}
                          type="url"
                          className="mb-2"
                          placeholder="https://example.com/image.jpg"
                          value={url}
                          onChange={(e) => handleEditPhotoChange(index, e.target.value)}
                        />
                      ))}
                      {editForm.photos.filter((url) => url.trim() !== '').length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mb-2">
                          {editForm.photos
                            .filter((url) => url.trim() !== '')
                            .map((url, idx) => (
                              <Image key={idx} src={url} thumbnail width={80} height={80} alt="Preview" />
                            ))}
                        </div>
                      )}
                      <Form.Control
                        type="file"
                        accept="image/*"
                        onChange={(e: any) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                const newPhotos = [...editForm.photos];
                                newPhotos.push(event.target.result as string);
                                setEditForm({ ...editForm, photos: newPhotos });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Form.Text className="text-muted">
                        Upload truck photos (max 5)
                      </Form.Text>
                    </Form.Group>
                  </Col>
              </Row>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={updatingTruck}>
                  {updatingTruck ? 'Updating...' : 'Update Truck'}
                </Button>
              </div>
          </Modal.Body>
            </Form>
        </Modal>
        <Modal show={showRemovalModal} onHide={() => setShowRemovalModal(false)} centered>
            <Form onSubmit={handleSubmitRemoval}>
              <Modal.Header closeButton>
                <Modal.Title>Request Vehicle Removal</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p className="small text-muted">
                  Tell the admin why this truck should be removed from the marketplace. Your request will be reviewed and
                  either approved or declined.
                </p>
                {selectedTruck && (
                  <p>
                    <strong>Vehicle:</strong> {selectedTruck.type?.toUpperCase()} – {selectedTruck.registrationNumber}
                  </p>
                )}
                <Form.Group>
                  <Form.Label>Reason for removal</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={removalReason}
                    onChange={(e) => setRemovalReason(e.target.value)}
                    placeholder="e.g. Vehicle is sold, undergoing long-term maintenance, or temporarily out of service."
                    required
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowRemovalModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger">
                  Submit Request
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>
        </Container>
      </div>
    </div>
  );
};
export default TruckerVehicles;