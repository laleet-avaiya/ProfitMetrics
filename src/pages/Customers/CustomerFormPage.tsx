import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserCircle } from "lucide-react";
import { PageHeader, PageShell } from "../../components/PageShell/PageShell";
import { Input } from "../../components/Input/Input";
import { Textarea } from "../../components/Textarea/Textarea";
import { Select } from "../../components/Select/Select";
import {
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPanel,
  FormReadyBanner,
} from "../../components/FormPage";
import { FormTabs } from "../../components/ui/FormTabs";
import { useAuth } from "../../hooks/useAuth";
import { useNotification } from "../../hooks/useNotification";
import { firestoreService } from "../../services/firestore";
import type { Customer } from "../../types";
import {
  buildCustomerFromForm,
  customerToForm,
  emptyCustomerForm,
  type CustomerFormState,
} from "../../utils/customerHelpers";

type CustomerFormTab = "details";

export function CustomerFormPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(customerId);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [form, setForm] = useState<CustomerFormState>(() =>
    emptyCustomerForm(),
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<CustomerFormTab>("details");
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!isEditing || !company || !customerId) {
      setForm(emptyCustomerForm());
      setLoading(false);
      return;
    }
    firestoreService.customers.get(company.id, customerId).then((found) => {
      if (found?.deleted) {
        setCustomer(null);
        setForm(emptyCustomerForm());
      } else {
        setCustomer(found);
        setForm(found ? customerToForm(found) : emptyCustomerForm());
      }
      setLoading(false);
    });
  }, [company, isEditing, customerId]);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Customer name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !validate()) return;
    setSaving(true);
    try {
      const payload = buildCustomerFromForm(
        form,
        company.id,
        customer ?? undefined,
      );
      if (isEditing && customer) {
        await firestoreService.customers.update(
          company.id,
          customer.id,
          payload,
          user!.uid,
        );
        notification.success("Customer updated");
        navigate(`/customers/${customer.id}`);
      } else {
        const created = await firestoreService.customers.create(
          company.id,
          payload,
          user!.uid,
        );
        notification.success("Customer added");
        navigate(`/customers/${created.id}`);
      }
    } catch {
      notification.error("Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const cancelTo =
    isEditing && customer ? `/customers/${customer.id}` : "/customers";
  const isReady = !isEditing && form.name.trim().length > 0;

  const formTabs = [
    { id: "details" as const, label: "Details", icon: UserCircle },
  ];

  if (loading) {
    return (
      <PageShell>
        <FormPageLoading message="Loading customer…" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={isEditing ? "Edit customer" : "New customer"}
        description="Contact details for invoicing."
        actions={
          <FormPageHeaderActions
            formId="customer-form"
            onCancel={() => navigate(cancelTo)}
            saving={saving}
            isEditing={isEditing}
            createLabel="Add customer"
          />
        }
      />

      <FormPageBody id="customer-form" onSubmit={handleSubmit}>
        <FormTabs
          tabs={formTabs}
          active={activeTab}
          onChange={(id) => setActiveTab(id as CustomerFormTab)}
          ariaLabel="Customer form sections"
        />

        <FormPageGrid>
          <FormPanel role="tabpanel">
            {activeTab === "details" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  error={errors.name}
                  required
                />
                <Input
                  label="Contact name"
                  value={form.contactName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, contactName: e.target.value }))
                  }
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
                <Input
                  label="Tax ID (TRN/GSTIN)"
                  value={form.taxId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, taxId: e.target.value }))
                  }
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as Customer["status"],
                    }))
                  }
                  options={[
                    { value: "active", label: "Active" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Address"
                    value={form.address}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, address: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Textarea
                    label="Notes"
                    optional
                    value={form.notes}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
              </div>
            ) : null}
          </FormPanel>
        </FormPageGrid>

        {isReady ? (
          <FormReadyBanner>
            <span className="font-medium">{form.name.trim()}</span> is ready to
            add.
          </FormReadyBanner>
        ) : null}

        <FormPageMobileActions
          onCancel={() => navigate(cancelTo)}
          saving={saving}
          isEditing={isEditing}
          createLabel="Add customer"
        />
      </FormPageBody>
    </PageShell>
  );
}
