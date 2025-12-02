import React, { useState, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, Image, Alert } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { trucksAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const TruckerAddVehicle: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [addingTruck, setAddingTruck] = useState(false);
  const [truckForm, setTruckForm] = useState({
    type: 'pickup',
    capacity: '',
    registrationNumber: '',
    perKm: '',
    minimumCharge: '',
    address: '',
    photos: [''],
    proofOfOwnership: ''
  });

  const handlePhotoChange = (index: number, value: string) => {
    const updatedPhotos = [...truckForm.photos];
    updatedPhotos[index] = value;
    setTruckForm({ ...truckForm, photos: updatedPhotos });
  };

  const addPhotoField = () => {
    setTruckForm({ ...truckForm, photos: [...truckForm.photos, ''] });
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });

    const converted = await Promise.all(Array.from(files).map((file) => toBase64(file)));
    setTruckForm((prev) => ({
      ...prev,
      photos: [...prev.photos.filter((url) => url.trim() !== ''), ...converted]
    }));
  };

  const handleProofOfOwnershipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setTruckForm({ ...truckForm, proofOfOwnership: base64 });
      if (files.length > 1) {
        toast.info(`${files.length} files selected. The first file has been uploaded. Additional files can be uploaded separately.`);
      } else {
        toast.success('Document uploaded successfully');
      }
    } catch (error) {
      toast.error('Failed to upload document(s)');
    }
  };

  const handleTruckSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setAddingTruck(true);
      const payload: any = {
        type: truckForm.type,
        capacity: { weight: parseFloat(truckForm.capacity) },
        registrationNumber: truckForm.registrationNumber,
        rates: {
          perKm: parseFloat(truckForm.perKm),
          minimumCharge: parseFloat(truckForm.minimumCharge)
        },
        location: {
          address: truckForm.address
        },
        photos: truckForm.photos.filter((url) => url.trim() !== ''),
        availability: {
          isAvailable: true
        }
      };

      if (truckForm.proofOfOwnership) {
        payload.proofOfOwnership = truckForm.proofOfOwnership;
      }

      await trucksAPI.create(payload);
      toast.success('Vehicle added successfully!');
      navigate('/dashboard/trucker');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setAddingTruck(false);
    }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <h2 className="mb-1 fw-bold">Add New Vehicle</h2>
              <p className="text-muted mb-0">Register your truck to start receiving bookings</p>
            </Col>
          </Row>

          <Card className="mb-4" style={{ border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }}>
            <Card.Body>
              <Form onSubmit={handleTruckSubmit}>
                <Row className="g-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Vehicle Type</Form.Label>
                      <Form.Select
                        value={truckForm.type}
                        onChange={(e) => setTruckForm({ ...truckForm, type: e.target.value })}
                      >
                        <option value="pickup">Pickup</option>
                        <option value="lorry">Lorry</option>
                        <option value="truck">Truck</option>
                        <option value="container">Container</option>
                        <option value="flatbed">Flatbed</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Capacity (tons)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.1"
                        value={truckForm.capacity}
                        onChange={(e) => setTruckForm({ ...truckForm, capacity: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Registration Number</Form.Label>
                      <Form.Control
                        type="text"
                        value={truckForm.registrationNumber}
                        onChange={(e) => setTruckForm({ ...truckForm, registrationNumber: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Rate per KM (KES)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={truckForm.perKm}
                        onChange={(e) => setTruckForm({ ...truckForm, perKm: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Minimum Charge (KES)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        value={truckForm.minimumCharge}
                        onChange={(e) => setTruckForm({ ...truckForm, minimumCharge: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label>Base Location</Form.Label>
                      <Form.Control
                        type="text"
                        value={truckForm.address}
                        onChange={(e) => setTruckForm({ ...truckForm, address: e.target.value })}
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="g-3 mt-2">
                  <Col md={12}>
                    <Form.Label>Vehicle Photos</Form.Label>
                    {truckForm.photos.map((url, index) => (
                      <Form.Control
                        key={index}
                        type="url"
                        className="mb-2"
                        placeholder="https://example.com/photo.jpg"
                        value={url}
                        onChange={(e) => handlePhotoChange(index, e.target.value)}
                      />
                    ))}
                    {truckForm.photos.filter((url) => url.trim() !== '').length > 0 && (
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        {truckForm.photos
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
                      onChange={(e) => handlePhotoUpload((e.target as HTMLInputElement).files)}
                    />
                    <Button variant="link" type="button" onClick={addPhotoField}>
                      + Add another link
                    </Button>
                  </Col>
                </Row>

                <Row className="g-3 mt-2">
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
                        onChange={handleProofOfOwnershipUpload}
                      />
                      {truckForm.proofOfOwnership && (
                        <div className="mt-2">
                          <Alert variant="success" className="mb-0 py-2">
                            Document(s) uploaded successfully
                          </Alert>
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                <div className="text-end mt-3">
                  <Button variant="outline-secondary" className="me-2" onClick={() => navigate('/dashboard/trucker')}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={addingTruck}>
                    {addingTruck ? 'Saving...' : 'Save Vehicle'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Container>
      </div>
    </div>
  );
};

export default TruckerAddVehicle;

