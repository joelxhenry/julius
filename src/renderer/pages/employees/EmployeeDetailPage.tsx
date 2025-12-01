import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Tabs,
  Table,
  Loader,
  Alert,
  Card,
  SimpleGrid,
  Pagination,
  Skeleton,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconShield,
  IconAlertCircle,
  IconFileInvoice,
  IconFileDescription,
  IconReceipt,
  IconCreditCard,
  IconClock,
  IconChartBar,
  IconUser,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';

interface Employee {
  id: number;
  code: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  address: string | null;
  phone: string | null;
  emergencyContact: string | null;
  username: string | null;
  status: string | null;
  isSalesperson: boolean | null;
  commission: string | null;
  startDate: string | null;
  createdAt: Date;
}

interface ActivitySummary {
  invoices: { count: number; totalAmount: number };
  quotations: { count: number; totalAmount: number };
  creditNotes: { count: number; totalAmount: number };
  payments: { count: number; totalAmount: number };
  attendance: { totalDays: number };
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function EmployeeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('summary');

  // Activity summary state
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Activity lists state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(1);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [quotations, setQuotations] = useState<any[]>([]);
  const [quotationsPage, setQuotationsPage] = useState(1);
  const [quotationsTotalPages, setQuotationsTotalPages] = useState(1);
  const [quotationsLoading, setQuotationsLoading] = useState(false);

  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [creditNotesPage, setCreditNotesPage] = useState(1);
  const [creditNotesTotalPages, setCreditNotesTotalPages] = useState(1);
  const [creditNotesLoading, setCreditNotesLoading] = useState(false);

  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceTotalPages, setAttendanceTotalPages] = useState(1);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const employeeId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (employeeId) {
      loadEmployee(employeeId);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId && activeTab === 'summary') {
      loadSummary(employeeId);
    }
  }, [employeeId, activeTab]);

  useEffect(() => {
    if (employeeId && activeTab === 'invoices') {
      loadInvoices(employeeId, invoicesPage);
    }
  }, [employeeId, activeTab, invoicesPage]);

  useEffect(() => {
    if (employeeId && activeTab === 'quotations') {
      loadQuotations(employeeId, quotationsPage);
    }
  }, [employeeId, activeTab, quotationsPage]);

  useEffect(() => {
    if (employeeId && activeTab === 'creditNotes') {
      loadCreditNotes(employeeId, creditNotesPage);
    }
  }, [employeeId, activeTab, creditNotesPage]);

  useEffect(() => {
    if (employeeId && activeTab === 'payments') {
      loadPayments(employeeId, paymentsPage);
    }
  }, [employeeId, activeTab, paymentsPage]);

  useEffect(() => {
    if (employeeId && activeTab === 'attendance') {
      loadAttendance(employeeId, attendancePage);
    }
  }, [employeeId, activeTab, attendancePage]);

  const loadEmployee = async (empId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: empId });
      if (result.success && result.data) {
        setEmployee(result.data);
      } else {
        setError(result.error || 'Failed to load employee');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (empId: number) => {
    setSummaryLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_ACTIVITY_SUMMARY, { employeeId: empId });
      if (result.success && result.data) {
        setSummary(result.data);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadInvoices = async (empId: number, page: number) => {
    setInvoicesLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_INVOICES, { employeeId: empId, page, pageSize: 10 });
      if (result.success && result.data) {
        setInvoices(result.data.data);
        setInvoicesTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const loadQuotations = async (empId: number, page: number) => {
    setQuotationsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_QUOTATIONS, { employeeId: empId, page, pageSize: 10 });
      if (result.success && result.data) {
        setQuotations(result.data.data);
        setQuotationsTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load quotations:', err);
    } finally {
      setQuotationsLoading(false);
    }
  };

  const loadCreditNotes = async (empId: number, page: number) => {
    setCreditNotesLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_CREDIT_NOTES, { employeeId: empId, page, pageSize: 10 });
      if (result.success && result.data) {
        setCreditNotes(result.data.data);
        setCreditNotesTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load credit notes:', err);
    } finally {
      setCreditNotesLoading(false);
    }
  };

  const loadPayments = async (empId: number, page: number) => {
    setPaymentsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_PAYMENTS, { employeeId: empId, page, pageSize: 10 });
      if (result.success && result.data) {
        setPayments(result.data.data);
        setPaymentsTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadAttendance = async (empId: number, page: number) => {
    setAttendanceLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_ATTENDANCE, { employeeId: empId, page, pageSize: 10 });
      if (result.success && result.data) {
        setAttendance(result.data.data);
        setAttendanceTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-JM', {
      style: 'currency',
      currency: 'JMD',
    }).format(amount);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'suspended':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading employee...</Text>
      </Stack>
    );
  }

  if (error || !employee) {
    return (
      <Stack p="xl" gap="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/employees')}
        >
          Back to Employees
        </Button>
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error || 'Employee not found'}
        </Alert>
      </Stack>
    );
  }

  const employeeName = employee.firstName || employee.lastName
    ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    : employee.code;

  return (
    <Stack p="xl" gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/employees')}
          >
            Back
          </Button>
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>{employeeName}</Title>
              <Badge color={getStatusColor(employee.status)} variant="light">
                {employee.status || 'Unknown'}
              </Badge>
              {employee.isSalesperson && (
                <Badge color="violet" variant="light">
                  Salesperson
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              Code: {employee.code} {employee.username && `| Username: ${employee.username}`}
            </Text>
          </Stack>
        </Group>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconShield size={16} />}
            onClick={() => navigate(`/employees/${employee.id}/permissions`)}
          >
            Permissions
          </Button>
          <Button
            leftSection={<IconEdit size={16} />}
            onClick={() => navigate(`/employees/${employee.id}/edit`)}
          >
            Edit
          </Button>
        </Group>
      </Group>

      {/* Employee Info Card */}
      <Paper p="lg" radius="md" withBorder>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Title</Text>
            <Text fw={500}>{employee.title || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Department</Text>
            <Text fw={500}>{employee.department || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Phone</Text>
            <Text fw={500}>{employee.phone || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Start Date</Text>
            <Text fw={500}>{employee.startDate || '-'}</Text>
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Activity Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="summary" leftSection={<IconChartBar size={16} />}>
            Summary
          </Tabs.Tab>
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>
            Invoices
          </Tabs.Tab>
          <Tabs.Tab value="quotations" leftSection={<IconFileDescription size={16} />}>
            Quotations
          </Tabs.Tab>
          <Tabs.Tab value="creditNotes" leftSection={<IconReceipt size={16} />}>
            Credit Notes
          </Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCreditCard size={16} />}>
            Payments
          </Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconClock size={16} />}>
            Attendance
          </Tabs.Tab>
        </Tabs.List>

        {/* Summary Tab */}
        <Tabs.Panel value="summary" pt="md">
          {summaryLoading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={100} radius="md" />
              ))}
            </SimpleGrid>
          ) : summary ? (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
              <Card withBorder radius="md" p="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Invoices</Text>
                <Text size="xl" fw={700}>{summary.invoices.count}</Text>
                <Text size="sm" c="dimmed">{formatCurrency(summary.invoices.totalAmount)}</Text>
              </Card>
              <Card withBorder radius="md" p="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Quotations</Text>
                <Text size="xl" fw={700}>{summary.quotations.count}</Text>
                <Text size="sm" c="dimmed">{formatCurrency(summary.quotations.totalAmount)}</Text>
              </Card>
              <Card withBorder radius="md" p="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Credit Notes</Text>
                <Text size="xl" fw={700}>{summary.creditNotes.count}</Text>
                <Text size="sm" c="dimmed">{formatCurrency(summary.creditNotes.totalAmount)}</Text>
              </Card>
              <Card withBorder radius="md" p="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payments Processed</Text>
                <Text size="xl" fw={700}>{summary.payments.count}</Text>
                <Text size="sm" c="dimmed">{formatCurrency(summary.payments.totalAmount)}</Text>
              </Card>
              <Card withBorder radius="md" p="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Attendance</Text>
                <Text size="xl" fw={700}>{summary.attendance.totalDays}</Text>
                <Text size="sm" c="dimmed">days recorded</Text>
              </Card>
            </SimpleGrid>
          ) : (
            <Text c="dimmed">No activity data available</Text>
          )}
        </Tabs.Panel>

        {/* Invoices Tab */}
        <Tabs.Panel value="invoices" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Invoice #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invoicesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  ) : invoices.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="xl">No invoices found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    invoices.map((inv) => (
                      <Table.Tr key={inv.id}>
                        <Table.Td><Text fw={500}>{inv.invNumber}</Text></Table.Td>
                        <Table.Td>{inv.invDate}</Table.Td>
                        <Table.Td>{inv.clientName || '-'}</Table.Td>
                        <Table.Td>{formatCurrency(parseFloat(inv.total || '0'))}</Table.Td>
                        <Table.Td>
                          <Badge color={inv.status === 'A' ? 'green' : 'gray'} variant="light" size="sm">
                            {inv.status === 'A' ? 'Active' : inv.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {invoicesTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={invoicesTotalPages} value={invoicesPage} onChange={setInvoicesPage} size="sm" />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Quotations Tab */}
        <Tabs.Panel value="quotations" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Quote #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {quotationsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  ) : quotations.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed" ta="center" py="xl">No quotations found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    quotations.map((quote) => (
                      <Table.Tr key={quote.id}>
                        <Table.Td><Text fw={500}>{quote.quoteNum}</Text></Table.Td>
                        <Table.Td>{quote.quoteDate}</Table.Td>
                        <Table.Td>{quote.clientName || '-'}</Table.Td>
                        <Table.Td>{formatCurrency(parseFloat(quote.total || '0'))}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {quotationsTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={quotationsTotalPages} value={quotationsPage} onChange={setQuotationsPage} size="sm" />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Credit Notes Tab */}
        <Tabs.Panel value="creditNotes" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>CR #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Invoice #</Table.Th>
                    <Table.Th>Client</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {creditNotesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  ) : creditNotes.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="xl">No credit notes found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    creditNotes.map((cr) => (
                      <Table.Tr key={cr.id}>
                        <Table.Td><Text fw={500}>{cr.crNumber}</Text></Table.Td>
                        <Table.Td>{cr.crDate}</Table.Td>
                        <Table.Td>{cr.invNumber || '-'}</Table.Td>
                        <Table.Td>{cr.clientName || '-'}</Table.Td>
                        <Table.Td>{formatCurrency(parseFloat(cr.total || '0'))}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {creditNotesTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={creditNotesTotalPages} value={creditNotesPage} onChange={setCreditNotesPage} size="sm" />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Payments Tab */}
        <Tabs.Panel value="payments" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Document</Table.Th>
                    <Table.Th>Payer</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Amount</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paymentsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  ) : payments.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="xl">No payments found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    payments.map((payment) => (
                      <Table.Tr key={payment.id}>
                        <Table.Td>{payment.paymentDate || '-'}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">
                            {payment.documentType}
                          </Badge>
                          {' '}{payment.documentNumber}
                        </Table.Td>
                        <Table.Td>{payment.payerName || '-'}</Table.Td>
                        <Table.Td>{payment.paymentDesc || '-'}</Table.Td>
                        <Table.Td>{formatCurrency(parseFloat(payment.amount || '0'))}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {paymentsTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={paymentsTotalPages} value={paymentsPage} onChange={setPaymentsPage} size="sm" />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Attendance Tab */}
        <Tabs.Panel value="attendance" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>In Time</Table.Th>
                    <Table.Th>Out Time</Table.Th>
                    <Table.Th>Description</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {attendanceLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  ) : attendance.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="xl">No attendance records found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    attendance.map((record) => (
                      <Table.Tr key={record.id}>
                        <Table.Td>{record.logDate}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">
                            {record.logType}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{record.inTime1 || record.activityTime || '-'}</Table.Td>
                        <Table.Td>{record.outTime1 || '-'}</Table.Td>
                        <Table.Td>{record.activityDesc || '-'}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {attendanceTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={attendanceTotalPages} value={attendancePage} onChange={setAttendancePage} size="sm" />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
