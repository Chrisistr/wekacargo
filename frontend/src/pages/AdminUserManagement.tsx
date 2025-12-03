import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, Tabs, Tab, Modal, Alert } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { toast } from 'react-toastify';
import { adminAPI, notificationsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
const AdminUserManagement: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'trucker' | 'customer'>('all');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationTargetUser, setNotificationTargetUser] = useState<any>(null);
  const [sendToAllUsers, setSendToAllUsers] = useState(false);
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (selectedRole !== 'all') {
        params.role = selectedRole;
      }
      const response = await adminAPI.getUsers(params);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedRole]);
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user, fetchUsers]);
  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await adminAPI.updateUser(userId, { status });
      toast.success('User status updated');
      fetchUsers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to update user status';
      toast.error(errorMessage);
    }
  };
  const handleSendNotification = (targetUser: any = null) => {
    setNotificationTargetUser(targetUser);
    setSendToAllUsers(!targetUser);
    setNotificationTitle('');
    setNotificationMessage('');
    setShowNotificationModal(true);
  };
  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      toast.error('Please fill in both title and message');
      return;
    }
    if (!sendToAllUsers && !notificationTargetUser) {
      toast.error('Please select a user or choose to send to all users');
      return;
    }
    setSendingNotification(true);
    try {
      if (sendToAllUsers) {
        const allUsersResponse = await adminAPI.getUsers({});
        const allUserIds = allUsersResponse.data.map((u: any) => u._id);
        await notificationsAPI.adminSend({
          userIds: allUserIds,
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
          type: 'system'
        });
        toast.success(`Notification sent to all ${allUserIds.length} users`);
      } else {
        await notificationsAPI.adminSend({
          userId: notificationTargetUser._id,
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
          type: 'system'
        });
        toast.success(`Notification sent to ${notificationTargetUser.name}`);
      }
      setShowNotificationModal(false);
      setNotificationTitle('');
      setNotificationMessage('');
      setNotificationTargetUser(null);
      setSendToAllUsers(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };
  const getStatusBadge = (status: string) => {
    const variants: any = {
      active: 'success',
      suspended: 'warning',
      banned: 'danger'
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };
  return (
    <div style={{ background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', padding: '20px' }}>
        <Container className="py-5" style={{ maxWidth: '100%' }}>
          <Row className="mb-4">
            <Col>
              <h2 className="mb-1 fw-bold">User Management</h2>
              <p className="text-muted mb-0">Manage all platform users, view details, and send notifications</p>
            </Col>
          </Row>
          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">Users</h3>
                <div className="d-flex gap-2 align-items-center">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSendNotification(null)}
                  >
                    Notify All Users
                  </Button>
                  <div className="d-flex gap-2" style={{ width: '400px' }}>
                    <Form.Control
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Form.Select
                      style={{ width: '150px' }}
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as 'all' | 'trucker' | 'customer')}
                    >
                      <option value="all">All Users</option>
                      <option value="trucker">Truckers</option>
                      <option value="customer">Customers</option>
                    </Form.Select>
                  </div>
                </div>
              </div>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <Tabs defaultActiveKey="truckers" className="mb-3">
                  <Tab eventKey="truckers" title={`Truckers (${users.filter(u => u.role === 'trucker').length})`}>
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Rating</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.filter(u => u.role === 'trucker').map((u) => (
                          <tr key={u._id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>{u.phone}</td>
                            <td>{getStatusBadge(u.status)}</td>
                            <td>
                              <span className="rating-stars-filled">
                                {'★'.repeat(Math.floor(u.rating?.average || 0))}
                              </span>
                              <span className="rating-stars-empty">
                                {'☆'.repeat(5 - Math.floor(u.rating?.average || 0))}
                              </span>
                              {' '}{u.rating?.average?.toFixed(1) || 0}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="d-flex gap-1">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleSendNotification(u)}
                                >
                                  Notify
                                </Button>
                                {u.role === 'admin' ? (
                                  <Badge bg="info">Protected</Badge>
                                ) : u.status === 'active' ? (
                                  <Badge 
                                    bg="danger" 
                                    className="cursor-pointer"
                                    onClick={() => updateUserStatus(u._id, 'suspended')}
                                  >
                                    Suspend
                                  </Badge>
                                ) : (
                                  <Badge 
                                    bg="success" 
                                    className="cursor-pointer"
                                    onClick={() => updateUserStatus(u._id, 'active')}
                                  >
                                    Activate
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {users.filter(u => u.role === 'trucker').length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-muted">
                              No truckers found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Tab>
                  <Tab eventKey="customers" title={`Customers (${users.filter(u => u.role === 'customer').length})`}>
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Rating</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.filter(u => u.role === 'customer').map((u) => (
                          <tr key={u._id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>{u.phone}</td>
                            <td>{getStatusBadge(u.status)}</td>
                            <td>
                              <span className="rating-stars-filled">
                                {'★'.repeat(Math.floor(u.rating?.average || 0))}
                              </span>
                              <span className="rating-stars-empty">
                                {'☆'.repeat(5 - Math.floor(u.rating?.average || 0))}
                              </span>
                              {' '}{u.rating?.average?.toFixed(1) || 0}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <div className="d-flex gap-1">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleSendNotification(u)}
                                >
                                  Notify
                                </Button>
                                {u.role === 'admin' ? (
                                  <Badge bg="info">Protected</Badge>
                                ) : u.status === 'active' ? (
                                  <Badge 
                                    bg="danger" 
                                    className="cursor-pointer"
                                    onClick={() => updateUserStatus(u._id, 'suspended')}
                                  >
                                    Suspend
                                  </Badge>
                                ) : (
                                  <Badge 
                                    bg="success" 
                                    className="cursor-pointer"
                                    onClick={() => updateUserStatus(u._id, 'active')}
                                  >
                                    Activate
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {users.filter(u => u.role === 'customer').length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-muted">
                              No customers found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Tab>
                </Tabs>
              )}
            </Card.Body>
          </Card>
          {}
          <Modal show={showNotificationModal} onHide={() => {
            setShowNotificationModal(false);
            setNotificationTitle('');
            setNotificationMessage('');
            setNotificationTargetUser(null);
            setSendToAllUsers(false);
          }}>
            <Modal.Header closeButton>
              <Modal.Title>Send Notification</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {sendToAllUsers ? (
                <Alert variant="warning" className="mb-3">
                  <strong>Sending to ALL Users:</strong> This notification will be sent to all registered users.
                </Alert>
              ) : notificationTargetUser && (
                <Alert variant="info" className="mb-3">
                  <strong>To:</strong> {notificationTargetUser.name} ({notificationTargetUser.email})
                  <br />
                  <strong>Role:</strong> {notificationTargetUser.role}
                </Alert>
              )}
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Title *</Form.Label>
                  <Form.Control
                    type="text"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    placeholder="e.g. Important Update, System Maintenance"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Message *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={5}
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    placeholder="Enter the notification message..."
                    required
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNotificationModal(false);
                  setNotificationTitle('');
                  setNotificationMessage('');
                  setNotificationTargetUser(null);
                  setSendToAllUsers(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={sendNotification}
                disabled={sendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
              >
                {sendingNotification ? 'Sending...' : sendToAllUsers ? 'Send to All Users' : 'Send Notification'}
              </Button>
            </Modal.Footer>
          </Modal>
        </Container>
      </div>
    </div>
  );
};
export default AdminUserManagement;
