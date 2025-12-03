import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, Modal, Alert } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { adminAPI } from '../services/api';
import Sidebar from '../components/Sidebar';

const AdminPaymentManagement: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [payments, setPayments] = useState<any[]>([]);
  const [escrowSummary, setEscrowSummary] = useState<any>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [escrowStatusFilter, setEscrowStatusFilter] = useState<string>('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const fetchEscrowSummary = useCallback(async () => {
    try {
      const response = await adminAPI.getEscrowSummary();
      setEscrowSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch escrow summary');
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      setLoadingPayments(true);
      const params: any = {};
      if (paymentStatusFilter !== 'all') params.status = paymentStatusFilter;
      if (escrowStatusFilter !== 'all') params.escrowStatus = escrowStatusFilter;
      if (paymentSearch.trim()) params.search = paymentSearch.trim();
      const response = await adminAPI.getPayments(params);
      setPayments(response.data.payments || []);
    } catch (error) {
      toast.error('Failed to fetch payments');
    } finally {
      setLoadingPayments(false);
    }
  }, [paymentStatusFilter, escrowStatusFilter, paymentSearch]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchEscrowSummary();
      fetchPayments();
    }
  }, [user, fetchEscrowSummary, fetchPayments]);

  const handleRefund = async () => {
    if (!refundReason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    try {
      await adminAPI.approveRefund(selectedPayment._id, {
        refundReason: refundReason.trim(),
        adminNote: adminNote.trim() || undefined
      });
      toast.success('Refund processed successfully');
      setShowRefundModal(false);
      setRefundReason('');
      setAdminNote('');
      setSelectedPayment(null);
      fetchPayments();
      fetchEscrowSummary();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process refund');
    }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <h2 className="mb-1 fw-bold">Payment Management</h2>
              <p className="text-muted mb-0">Monitor payments, escrow funds, and process refunds</p>
            </Col>
          </Row>

          {/* Escrow Funds Summary */}
          {escrowSummary && (
            <Row className="mb-4 g-3">
              <Col md={4}>
                <Card className="border-primary">
                  <Card.Body>
                    <h6 className="text-primary text-uppercase small mb-1">Funds Held in Escrow</h6>
                    <h3 className="mb-0 text-primary">KES {escrowSummary.escrow?.held?.total?.toLocaleString() || 0}</h3>
                    <p className="mb-0 small text-muted">{escrowSummary.escrow?.held?.count || 0} payments awaiting completion</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="border-success">
                  <Card.Body>
                    <h6 className="text-success text-uppercase small mb-1">Funds Released</h6>
                    <h3 className="mb-0 text-success">KES {escrowSummary.escrow?.released?.total?.toLocaleString() || 0}</h3>
                    <p className="mb-0 small text-muted">{escrowSummary.escrow?.released?.count || 0} payments to truckers</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card className="border-warning">
                  <Card.Body>
                    <h6 className="text-warning text-uppercase small mb-1">Funds Refunded</h6>
                    <h3 className="mb-0 text-warning">KES {escrowSummary.escrow?.refunded?.total?.toLocaleString() || 0}</h3>
                    <p className="mb-0 small text-muted">{escrowSummary.escrow?.refunded?.count || 0} refunds processed</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Refunds Needed Section */}
          {payments.filter(p => 
            (p.escrowStatus === 'held' && p.status === 'completed') ||
            (p.status === 'cancelled' && p.escrowStatus === 'released') ||
            (p.status === 'completed' && p.escrowStatus === 'held' && !p.refundedAt)
          ).length > 0 && (
            <Card className="mb-4 border-warning">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h3 className="mb-1 text-warning">Refunds Needed</h3>
                    <p className="text-muted mb-0 small">
                      Payments that require refund processing
                    </p>
                  </div>
                  <Badge bg="warning" className="fs-6">
                    {payments.filter(p => 
                      (p.escrowStatus === 'held' && p.status === 'completed') ||
                      (p.status === 'cancelled' && p.escrowStatus === 'released') ||
                      (p.status === 'completed' && p.escrowStatus === 'held' && !p.refundedAt)
                    ).length} Pending
                  </Badge>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Payment ID</th>
                        <th>Customer</th>
                        <th>Trucker</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Escrow</th>
                        <th>Booking</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments
                        .filter(p => 
                          (p.escrowStatus === 'held' && p.status === 'completed') ||
                          (p.status === 'cancelled' && p.escrowStatus === 'released') ||
                          (p.status === 'completed' && p.escrowStatus === 'held' && !p.refundedAt)
                        )
                        .map((payment) => (
                          <tr key={payment._id}>
                            <td>
                              <small>{payment._id?.substring(0, 8)}...</small>
                            </td>
                            <td>
                              {payment.customer?.name || 'N/A'}
                              <br />
                              <small className="text-muted">{payment.customer?.email}</small>
                            </td>
                            <td>
                              {payment.trucker?.name || 'N/A'}
                              <br />
                              <small className="text-muted">{payment.trucker?.email}</small>
                            </td>
                            <td>KES {payment.amount?.toLocaleString()}</td>
                            <td>
                              <Badge bg={
                                payment.status === 'completed' ? 'success' :
                                payment.status === 'cancelled' ? 'danger' : 'secondary'
                              }>
                                {payment.status}
                              </Badge>
                            </td>
                            <td>
                              <Badge bg={
                                payment.escrowStatus === 'released' ? 'success' :
                                payment.escrowStatus === 'held' ? 'warning' : 'secondary'
                              }>
                                {payment.escrowStatus || 'N/A'}
                              </Badge>
                            </td>
                            <td>
                              <small>{payment.booking?._id?.substring(0, 8)}...</small>
                            </td>
                            <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                            <td>
                              {payment.escrowStatus === 'held' && payment.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowRefundModal(true);
                                  }}
                                >
                                  Process Refund
                                </Button>
                              )}
                              {payment.status === 'cancelled' && payment.escrowStatus === 'released' && (
                                <Badge bg="warning" className="text-dark">
                                  Manual Processing Required
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          )}

          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">All Payments</h3>
                <div className="d-flex gap-2" style={{ width: '600px' }}>
                  <Form.Control
                    type="text"
                    placeholder="Search payments..."
                    value={paymentSearch}
                    onChange={(e) => {
                      setPaymentSearch(e.target.value);
                      setTimeout(() => fetchPayments(), 500);
                    }}
                    style={{ width: '200px' }}
                  />
                  <Form.Select
                    style={{ width: '150px' }}
                    value={paymentStatusFilter}
                    onChange={(e) => {
                      setPaymentStatusFilter(e.target.value);
                      fetchPayments();
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </Form.Select>
                  <Form.Select
                    style={{ width: '150px' }}
                    value={escrowStatusFilter}
                    onChange={(e) => {
                      setEscrowStatusFilter(e.target.value);
                      fetchPayments();
                    }}
                  >
                    <option value="all">All Escrow</option>
                    <option value="held">Held</option>
                    <option value="released">Released</option>
                    <option value="refunded">Refunded</option>
                  </Form.Select>
                  <Button variant="outline-primary" size="sm" onClick={fetchPayments}>
                    Refresh
                  </Button>
                </div>
              </div>

              {loadingPayments ? (
                <p>Loading payments...</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>Payment ID</th>
                        <th>Customer</th>
                        <th>Trucker</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Escrow</th>
                        <th>Booking</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center text-muted">
                            No payments found
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment) => (
                          <tr key={payment._id}>
                            <td>
                              <small>{payment._id?.substring(0, 8)}...</small>
                            </td>
                            <td>
                              {payment.customer?.name || 'N/A'}
                              <br />
                              <small className="text-muted">{payment.customer?.email}</small>
                            </td>
                            <td>
                              {payment.trucker?.name || 'N/A'}
                              <br />
                              <small className="text-muted">{payment.trucker?.email}</small>
                            </td>
                            <td>KES {payment.amount?.toLocaleString()}</td>
                            <td>
                              <Badge bg={
                                payment.status === 'completed' ? 'success' :
                                payment.status === 'pending' ? 'warning' :
                                payment.status === 'refunded' ? 'danger' :
                                payment.status === 'failed' ? 'danger' : 'secondary'
                              }>
                                {payment.status}
                              </Badge>
                            </td>
                            <td>
                              <Badge bg={
                                payment.escrowStatus === 'released' ? 'success' :
                                payment.escrowStatus === 'held' ? 'warning' :
                                payment.escrowStatus === 'refunded' ? 'danger' : 'secondary'
                              }>
                                {payment.escrowStatus || 'N/A'}
                              </Badge>
                            </td>
                            <td>
                              <small>{payment.booking?._id?.substring(0, 8)}...</small>
                            </td>
                            <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                            <td>
                              {payment.escrowStatus === 'held' && payment.status === 'completed' && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowRefundModal(true);
                                  }}
                                >
                                  Refund
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Refund Modal */}
          <Modal show={showRefundModal} onHide={() => {
            setShowRefundModal(false);
            setRefundReason('');
            setAdminNote('');
            setSelectedPayment(null);
          }}>
            <Modal.Header closeButton>
              <Modal.Title>Process Refund</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedPayment && (
                <Alert variant="info" className="mb-3">
                  <strong>Payment:</strong> KES {selectedPayment.amount?.toLocaleString()}
                  <br />
                  <strong>Customer:</strong> {selectedPayment.customer?.name}
                  <br />
                  <strong>Booking ID:</strong> {selectedPayment.booking?._id?.substring(0, 8)}...
                </Alert>
              )}
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Refund Reason *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter reason for refund..."
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Admin Note (Optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Internal notes..."
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundReason('');
                  setAdminNote('');
                  setSelectedPayment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRefund}
                disabled={!refundReason.trim()}
              >
                Process Refund
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      </div>
    </div>
  );
};

export default AdminPaymentManagement;

