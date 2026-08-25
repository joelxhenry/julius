import { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Paper,
  Group,
  TextInput,
  Textarea,
  Button,
  Checkbox,
  NumberInput,
  Text,
  Alert,
  Title,
  ScrollArea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconUser,
  IconPhone,
  IconCreditCard,
  IconMapPin,
  IconBuildingStore,
} from "@tabler/icons-react";
import { IpcChannel } from "../../../shared/types/ipc";

interface Client {
  id: number;
  clNumber: string | null;
  clientName: string;
  contact: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  notes: string | null;
  isTaxable: boolean;
  creditLimit: string;
  creditTerms: string | null;
  creditEnabled: boolean;
  isBadCredit: boolean;
}

interface ClientFormValues {
  clNumber: string;
  clientName: string;
  contact: string;
  phone: string;
  address1: string;
  address2: string;
  notes: string;
  isTaxable: boolean;
  creditLimit: number;
  creditTerms: number | null;
  creditEnabled: boolean;
  isBadCredit: boolean;
}

interface ClientEditModalProps {
  opened: boolean;
  onClose: () => void;
  client: Client;
  onSave: () => void;
}

export function ClientEditModal({
  opened,
  onClose,
  client,
  onSave,
}: ClientEditModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ClientFormValues>({
    initialValues: {
      clNumber: "",
      clientName: "",
      contact: "",
      phone: "",
      address1: "",
      address2: "",
      notes: "",
      isTaxable: true,
      creditLimit: 0,
      creditTerms: null,
      creditEnabled: true,
      isBadCredit: false,
    },
    validate: {
      clientName: (value) => (!value ? "Client name is required" : null),
      creditLimit: (value) => (value < 0 ? "Cannot be negative" : null),
      creditTerms: (value) =>
        value != null && (value < 0 || !Number.isInteger(value))
          ? "Enter a whole number of days"
          : null,
    },
  });

  // Set form values when client changes or modal opens
  useEffect(() => {
    if (opened && client) {
      form.setValues({
        clNumber: client.clNumber || "",
        clientName: client.clientName || "",
        contact: client.contact || "",
        phone: client.phone || "",
        address1: client.address1 || "",
        address2: client.address2 || "",
        notes: client.notes || "",
        isTaxable: client.isTaxable ?? true,
        creditLimit: client.creditLimit ? parseFloat(client.creditLimit) : 0,
        creditTerms: (() => {
          const parsed = parseInt(client.creditTerms || "", 10);
          return Number.isNaN(parsed) ? null : parsed;
        })(),
        creditEnabled: client.creditEnabled ?? true,
        isBadCredit: client.isBadCredit || false,
      });
      setError(null);
    }
  }, [opened, client]);

  const handleSubmit = async (values: ClientFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        clNumber: values.clNumber || null,
        clientName: values.clientName,
        contact: values.contact || null,
        phone: values.phone || null,
        address1: values.address1 || null,
        address2: values.address2 || null,
        notes: values.notes || null,
        isTaxable: values.isTaxable,
        creditLimit: values.creditLimit.toString(),
        creditTerms: (() => {
          const parsed = parseInt(String(values.creditTerms ?? ''), 10);
          return Number.isNaN(parsed) ? null : String(parsed);
        })(),
        creditEnabled: values.creditEnabled,
        isBadCredit: values.isBadCredit,
      };

      const result = await window.electron.invoke(IpcChannel.UPDATE_CLIENT, {
        id: client.id,
        data,
      });

      if (result.success) {
        notifications.show({
          title: "Client Updated",
          message: `${values.clientName} has been updated successfully`,
          color: "green",
          icon: <IconCheck size={16} />,
        });

        onSave();
        onClose();
      } else {
        setError(result.error || "Failed to save client");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconUser size={20} />
          <Text fw={600}>Edit Client: {client.clientName}</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <ScrollArea.Autosize mah="70vh">
          <Stack gap="lg" pr="xs">
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            {/* Basic Information */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconUser size={18} />
                  <Title order={5}>Basic Information</Title>
                </Group>

                <TextInput
                  label="Client Name"
                  placeholder="Enter client name"
                  required
                  {...form.getInputProps("clientName")}
                />

                <Group grow>
                  <TextInput
                    label="Client Number"
                    placeholder="e.g., CL-123456"
                    {...form.getInputProps("clNumber")}
                  />
                  <TextInput
                    label="Contact Person"
                    placeholder="Enter contact person"
                    {...form.getInputProps("contact")}
                  />
                </Group>
              </Stack>
            </Paper>

            {/* Contact Information */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconPhone size={18} />
                  <Title order={5}>Contact Information</Title>
                </Group>

                <TextInput
                  label="Phone"
                  placeholder="Enter phone number"
                  {...form.getInputProps("phone")}
                />
              </Stack>
            </Paper>

            {/* Address */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconMapPin size={18} />
                  <Title order={5}>Address</Title>
                </Group>

                <TextInput
                  label="Address Line 1"
                  placeholder="Enter street address"
                  {...form.getInputProps("address1")}
                />

                <TextInput
                  label="Address Line 2"
                  placeholder="Enter apartment, suite, etc."
                  {...form.getInputProps("address2")}
                />
              </Stack>
            </Paper>

            {/* Credit & Pricing */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconCreditCard size={18} />
                  <Title order={5}>Credit & Pricing</Title>
                </Group>

                <Group grow>
                  <NumberInput
                    label="Credit Limit"
                    placeholder="0.00"
                    prefix="$"
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    thousandSeparator=","
                    {...form.getInputProps("creditLimit")}
                  />
                  <NumberInput
                    label="Credit Terms"
                    description="Number of days credit is extended"
                    placeholder="e.g. 30"
                    suffix=" days"
                    min={0}
                    step={1}
                    allowDecimal={false}
                    allowNegative={false}
                    {...form.getInputProps("creditTerms")}
                  />
                </Group>

                <Group grow>
                  <Stack gap="xs" justify="flex-end">
                    <Checkbox
                      label="Enable Credit"
                      description="Allow this client to purchase on credit"
                      {...form.getInputProps("creditEnabled", { type: "checkbox" })}
                    />
                  </Stack>
                  <Stack gap="xs" justify="flex-end">
                    <Checkbox
                      label="Bad Credit"
                      description="Mark client as bad credit"
                      {...form.getInputProps("isBadCredit", { type: "checkbox" })}
                    />
                  </Stack>
                </Group>
              </Stack>
            </Paper>

            {/* Tax & Settings */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconBuildingStore size={18} />
                  <Title order={5}>Tax & Settings</Title>
                </Group>

                <Checkbox
                  label="Taxable"
                  description="Check if this client is taxable"
                  {...form.getInputProps("isTaxable", { type: "checkbox" })}
                />
              </Stack>
            </Paper>

            {/* Notes */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Title order={5}>Notes</Title>

                <Textarea
                  label="Notes"
                  placeholder="Enter any additional notes about this client"
                  rows={3}
                  {...form.getInputProps("notes")}
                />
              </Stack>
            </Paper>
          </Stack>
        </ScrollArea.Autosize>
        {/* Actions */}
        <Group justify="flex-end" pt={10}>
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={submitting}
          >
            Save Changes
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
