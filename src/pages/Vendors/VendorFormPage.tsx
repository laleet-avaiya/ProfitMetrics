import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { PageHeader, PageShell } from "../../components/PageShell/PageShell";
import { Input } from "../../components/Input/Input";
import { Textarea } from "../../components/Textarea/Textarea";
import { Select } from "../../components/Select/Select";
import {
  FormFieldGroup,
  FormFieldGroupDivider,
  FormPageBody,
  FormPageGrid,
  FormPageHeaderActions,
  FormPageLoading,
  FormPageMobileActions,
  FormPageNotFound,
  FormPanel,
  FormReadyBanner,
} from "../../components/FormPage";
import { FormTabs } from "../../components/ui/FormTabs";
import { useAuth } from "../../hooks/useAuth";
import { useNotification } from "../../hooks/useNotification";
import { firestoreService } from "../../services/firestore";
import type { Vendor } from "../../types";
import {
  buildVendorFromForm,
  emptyVendorForm,
  vendorToForm,
  type VendorFormState,
} from "../../utils/vendorHelpers";

type VendorFormTab = "details";

export function VendorFormPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { company, user } = useAuth();
  const notification = useNotification();
  const isEditing = Boolean(vendorId);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [form, setForm] = useState<VendorFormState>(() => emptyVendorForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<VendorFormTab>("details");
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!isEditing || !company || !vendorId) {
      setForm(emptyVendorForm());
      setVendor(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    firestoreService.vendors
      .get(company.id, vendorId)
      .then((found) => {
        if (cancelled) return;
        if (found?.deleted) {
          setVendor(null);
          setForm(emptyVendorForm());
          return;
        }
        setVendor(found);
        setForm(found ? vendorToForm(found) : emptyVendorForm());
      })
      .catch((err) => {
        console.error("Failed to load vendor:", err);
        if (!cancelled) notification.error("Failed to load vendor");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company, isEditing, vendorId, notification]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Vendor name is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = buildVendorFromForm(
        form,
        company.id,
        vendor ?? undefined,
      );

      if (isEditing && vendor) {
        await firestoreService.vendors.update(
          company.id,
          vendor.id,
          payload,
          user!.uid,
        );
        notification.success("Vendor updated");
        navigate(`/vendors/${vendor.id}`);
      } else {
        const created = await firestoreService.vendors.create(
          company.id,
          payload,
          user!.uid,
        );
        notification.success("Vendor added");
        navigate(`/vendors/${created.id}`);
      }
    } catch (err) {
      console.error("Failed to save vendor:", err);
      notification.error("Failed to save vendor. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancelTo = isEditing && vendor ? `/vendors/${vendor.id}` : "/vendors";
  const isReady = !isEditing && form.name.trim().length > 0;

  const formTabs = [
    { id: "details" as const, label: "Details", icon: Building2 },
  ];

  if (loading) {
    return (
      <PageShell>
        <FormPageLoading message="Loading vendor…" />
      </PageShell>
    );
  }

  if (isEditing && !vendor) {
    return (
      <PageShell>
        <FormPageNotFound
          title="Vendor not found"
          description="This vendor may have been deleted."
          backLabel="Back to vendors"
          onBack={() => navigate("/vendors")}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={isEditing ? "Edit vendor" : "Add vendor"}
        description={
          isEditing
            ? `Update details for ${vendor?.name ?? "vendor"}.`
            : "Add a supplier or payee to link with expenses."
        }
        actions={
          <FormPageHeaderActions
            formId="vendor-form"
            onCancel={() => navigate(cancelTo)}
            saving={saving}
            isEditing={isEditing}
            createLabel="Add vendor"
          />
        }
      />

      <FormPageBody id="vendor-form" onSubmit={handleSubmit}>
        <FormTabs
          tabs={formTabs}
          active={activeTab}
          onChange={(id) => setActiveTab(id as VendorFormTab)}
          ariaLabel="Vendor form sections"
        />

        <FormPageGrid>
          <FormPanel role="tabpanel">
            {activeTab === "details" ? (
              <>
                <FormFieldGroup
                  title="Vendor details"
                  description="Name and status for this payee."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Input
                        label="Vendor name"
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        error={errors.name}
                        required
                        placeholder="e.g. Amazon Ads, packaging supplier"
                      />
                    </div>
                    <Select
                      label="Status"
                      value={form.status}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "archived", label: "Archived" },
                      ]}
                      onChange={(e) => {
                        const nextStatus = e.target.value as Vendor["status"];
                        if (nextStatus === form.status) return;
                        const archiving = nextStatus === "archived";
                        notification.confirm({
                          title: archiving
                            ? "Archive vendor?"
                            : "Restore vendor?",
                          message: archiving
                            ? "This vendor will be archived and hidden from new expense entries."
                            : "This vendor will be restored and available for new expenses.",
                          confirmLabel: archiving ? "Archive" : "Restore",
                          variant: "primary",
                          onConfirm: () =>
                            setForm((f) => ({ ...f, status: nextStatus })),
                        });
                      }}
                    />
                  </div>
                </FormFieldGroup>

                <FormFieldGroupDivider />

                <FormFieldGroup
                  title="Contact"
                  description="Optional contact details."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Contact name"
                      value={form.contactName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, contactName: e.target.value }))
                      }
                    />
                    <Input
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                    <Input
                      label="Website"
                      type="url"
                      value={form.website}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, website: e.target.value }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <Textarea
                        label="Notes"
                        optional
                        value={form.notes}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, notes: e.target.value }))
                        }
                        placeholder="Payment terms, account numbers…"
                        rows={2}
                      />
                    </div>
                  </div>
                </FormFieldGroup>
              </>
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
          createLabel="Add vendor"
        />
      </FormPageBody>
    </PageShell>
  );
}
