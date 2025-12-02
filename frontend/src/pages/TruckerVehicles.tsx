import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Badge, Modal, Form, Alert, Image } from 'react-bootstrap';
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

  const addEditPhotoField = () => {
    setEditForm({ ...editForm, photos: [...editForm.photos, ''] });
  };

  const handleEditPhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

    const converted = await Promise.all(Array.from(files).map((file) => toBase64(file)));
    setEditForm((prev) => ({
      ...prev,
      photos: [...prev.photos.filter((url) => url.trim() !== ''), ...converted]
    }));
  };

  const handleEditProofOfOwnershipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

    try {
      // For multiple files, we'll store the first one or combine them
      // The backend can be extended later to handle multiple documents
      const base64 = await toBase64(files[0]);
      setEditForm((prev) => ({ ...prev, proofOfOwnership: base64 }));
      if (files.length > 1) {
        toast.info(`${files.length} files selected. The first file has been uploaded. Additional files can be uploaded separately.`);
      } else {
        toast.success('Document uploaded successfully');
      }
    } catch (error) {
      toast.error('Failed to upload document(s)');
    }
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

          {/* Edit Modal */}
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
                    <Form.Label>Vehicle Photos</Form.Label>
                    {editForm.photos.map((url, index) => (
                      <Form.Control
                        key={index}
                        type="url"
                        className="mb-2"
                        placeholder="https://example.com/photo.jpg"
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
                      multiple
                      className="mb-2"
                      onChange={(e) => handleEditPhotoUpload((e.target as HTMLInputElement).files)}
                    />
                    <Button variant="link" type="button" size="sm" onClick={addEditPhotoField}>
                      + Add another link
                    </Button>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Vehicle Documents (Proof of Ownership, Logbook, Insurance, etc.)</Form.Label>
                      <Alert variant="info" className="mb-3">
                        <strong>Important:</strong> We strongly encourage you to upload all relevant vehicle documents to build trust with customers and speed up verification. This includes:
                        <ul className="mb-0 mt-2">
                          <li><strong>Logbook</strong> - Official vehicle registration document</li>
                          <li><strong>Proof of Ownership</strong> - Title deed or purchase receipt</li>
                          <li><strong>Insurance Certificate</strong> - Valid insurance documentation</li>
                          <li><strong>Inspection Certificate</strong> - Roadworthiness certificate (if available)</li>
                        </ul>
                        <p className="mb-0 mt-2 small">These documents help customers feel confident booking your vehicle and may increase your booking rates. All documents are securely stored and only visible to administrators for verification purposes.</p>
                      </Alert>
                      <Form.Text className="text-muted d-block mb-2">
                        Upload documents or images (PDF, JPG, PNG). You can upload multiple files.
                      </Form.Text>
                      <Form.Control
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={handleEditProofOfOwnershipUpload}
                      />
                      {editForm.proofOfOwnership && (
                        <div className="mt-2">
                          <Alert variant="success" className="mb-0 py-2">
                            Document(s) uploaded successfully
                          </Alert>
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                </Row>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={updatingTruck}>
                  {updatingTruck ? 'Updating...' : 'Save Changes'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>

          {/* Removal Modal */}
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

