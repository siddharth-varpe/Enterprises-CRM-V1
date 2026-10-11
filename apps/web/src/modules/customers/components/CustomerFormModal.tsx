import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateCustomerSchema, type CreateCustomerInput } from '@crm/validation';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { useToast } from '../../../providers/ToastProvider';
import {
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  checkCustomerDuplicateApi,
  type CustomerSummary,
} from '../customer.api';
import { AlertCircle, User, Phone, Mail, Building, Plus, Trash2, MapPin, Crosshair, Navigation } from 'lucide-react';
import { AddressPinpointModal } from '../../../components/common/AddressPinpointModal';

export interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: CustomerSummary | null;
  onSuccess?: (customer: CustomerSummary) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const isEditing = !!customer;
  const toast = useToast();
  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation(customer?.id || '');

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const getInitialValues = (cust?: CustomerSummary | null): CreateCustomerInput => ({
    fullName: cust?.fullName || '',
    phone: cust?.phone || '',
    email: cust?.email || '',
    customerType: cust?.customerType || 'INDIVIDUAL',
    companyName: cust?.companyName || '',
    gstNumber: cust?.gstNumber || '',
    notes: cust?.notes || '',
    customerLabel: (cust as any)?.customerLabel ?? null,
    addresses: cust?.addresses && cust.addresses.length > 0
      ? cust.addresses.map((a) => ({
          addressType: a.addressType || 'SERVICE',
          addressLine1: (a.addressLine1 === 'Main Service Location' ? '' : a.addressLine1) || '',
          addressLine2: a.addressLine2 || '',
          landmark: a.landmark || '',
          city: a.city || '',
          state: a.state || '',
          postalCode: a.postalCode || (a as any).pincode || '',
          isDefault: a.isDefault ?? true,
          latitude: typeof a.latitude === 'number' ? a.latitude : (a as any)?.latitude ? Number((a as any).latitude) : null,
          longitude: typeof a.longitude === 'number' ? a.longitude : (a as any)?.longitude ? Number((a as any).longitude) : null,
        }))
      : [
          {
            addressType: 'SERVICE',
            addressLine1: '',
            addressLine2: '',
            landmark: '',
            city: '',
            state: '',
            postalCode: '',
            isDefault: true,
            latitude: null,
            longitude: null,
          },
        ],
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateCustomerInput>({
    resolver: zodResolver(CreateCustomerSchema) as any,
    defaultValues: getInitialValues(customer),
    shouldUnregister: false,
  });

  const [pinpointModalIndex, setPinpointModalIndex] = useState<number | null>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'addresses',
  });

  useEffect(() => {
    if (isOpen) {
      reset(getInitialValues(customer));
      setDuplicateWarning(null);
    }
  }, [isOpen, customer, reset]);

  const phoneValue = watch('phone');
  const emailValue = watch('email');
  const customerTypeValue = watch('customerType');

  // Real-time duplicate email checking on blur
  const handleCheckDuplicateEmail = async () => {
    if (emailValue && emailValue.includes('@')) {
      try {
        const result = await checkCustomerDuplicateApi({
          email: emailValue,
          excludeCustomerId: customer?.id,
        });
        if (result.isDuplicate && result.existingCustomer) {
          setDuplicateWarning(
            `A customer with email ${emailValue} already exists: ${result.existingCustomer.fullName} (${result.existingCustomer.customerNumber})`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // ignore network error on duplicate hint
      }
    }
  };

  const extractFirstErrorMessage = (errObj: any): string | null => {
    if (!errObj) return null;
    if (typeof errObj.message === 'string' && errObj.message) return errObj.message;
    if (Array.isArray(errObj)) {
      for (const item of errObj) {
        const msg = extractFirstErrorMessage(item);
        if (msg) return msg;
      }
    }
    if (typeof errObj === 'object') {
      for (const key of Object.keys(errObj)) {
        const msg = extractFirstErrorMessage(errObj[key]);
        if (msg) return msg;
      }
    }
    return null;
  };

  const onInvalid = (fieldErrors: any) => {
    const message = extractFirstErrorMessage(fieldErrors) || 'Please check required fields';
    toast.error(message, 'Validation Required');
  };

  const onSubmit = async (data: CreateCustomerInput) => {
    try {
      if (isEditing && customer) {
        const res = await updateMutation.mutateAsync(data);
        const updated = (res as any)?.data || res;
        if (!updated || !updated.id) {
          throw new Error('Failed to update customer: Server returned an invalid response');
        }
        toast.success(`Customer ${updated.fullName || data.fullName} updated successfully.`, 'Customer Updated');
        onClose();
        reset(getInitialValues(null));
        onSuccess?.(updated);
      } else {
        const res = await createMutation.mutateAsync(data);
        const created = (res as any)?.data || res;
        if (!created || !created.id) {
          throw new Error('Failed to create customer: Server returned an invalid response');
        }
        toast.success(
          `Customer ${created.fullName || data.fullName} (${created.customerNumber || 'Saved'}) created.`,
          'Customer Created'
        );
        onClose();
        reset(getInitialValues(null));
        onSuccess?.(created);
      }
    } catch (err: any) {
      console.error('[CustomerFormModal] Save Error:', err);
      const msg =
        err?.details?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save customer. Please check network connection.';
      toast.error(msg, 'Save Error');
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Customer: ${customer.fullName}` : 'Add New Customer'}
      description="Create a primary customer record with service location and contact information."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSubmit(onSubmit, onInvalid)}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isEditing ? 'Save Changes' : 'Create Customer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        {/* Duplicate Customer Alert Banner */}
        {duplicateWarning && (
          <div role="alert" className="p-3 bg-amber-50 border border-amber-200 rounded-btn flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Potential Duplicate Customer Detected</span>
              <p>{duplicateWarning}</p>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
            1. Customer Identity &amp; Contact
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              placeholder="e.g. Rajesh Kumar"
              required
              leftIcon={<User className="w-4 h-4" />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              label="Phone Number"
              placeholder="e.g. 9826123456"
              required
              leftIcon={<Phone className="w-4 h-4" />}
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Email Address (Optional)"
              type="email"
              placeholder="e.g. rajesh@gmail.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register('email')}
              onBlur={handleCheckDuplicateEmail}
            />

            <Select
              label="Customer Type"
              options={[
                { value: 'INDIVIDUAL', label: 'Individual / Residential' },
                { value: 'COMMERCIAL', label: 'Commercial / Business' },
              ]}
              {...register('customerType')}
            />
          </div>

          {customerTypeValue === 'COMMERCIAL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-btn">
              <Input
                label="Company / Establishment Name"
                placeholder="e.g. Apex Hospital & Diagnostics"
                leftIcon={<Building className="w-4 h-4" />}
                error={errors.companyName?.message}
                {...register('companyName')}
              />
              <Input
                label="GSTIN Number (Optional)"
                placeholder="e.g. 22AAAAA0000A1Z5"
                error={errors.gstNumber?.message}
                {...register('gstNumber')}
              />
            </div>
          )}
        </div>

        {/* Addresses Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                2. Customer Address
              </h4>
              <span className="text-[11px] text-slate-400 font-normal">(Service &amp; Installation Location)</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                append({
                  addressType: 'SERVICE',
                  addressLine1: '',
                  addressLine2: '',
                  landmark: '',
                  city: '',
                  state: '',
                  postalCode: '',
                  isDefault: false,
                  latitude: null,
                  longitude: null,
                });
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Another Address
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, idx) => {
              const currentLat = watch(`addresses.${idx}.latitude`);
              const currentLng = watch(`addresses.${idx}.longitude`);
              const hasPinpoint =
                currentLat !== null &&
                currentLat !== undefined &&
                currentLng !== null &&
                currentLng !== undefined &&
                !isNaN(Number(currentLat)) &&
                !isNaN(Number(currentLng));

              return (
                <div
                  key={field.id}
                  className="p-4 rounded-btn border border-slate-200 bg-slate-50/50 space-y-3 relative"
                >
                  {fields.length > 1 && (
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                      <span className="text-xs font-semibold text-slate-700">
                        Address #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded flex items-center gap-1 text-xs font-medium transition-colors"
                        aria-label={`Remove address ${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Address Line 1"
                      placeholder="House/Plot/Flat No., Street, Area"
                      leftIcon={<MapPin className="w-4 h-4 text-slate-400" />}
                      error={errors.addresses?.[idx]?.addressLine1?.message}
                      {...register(`addresses.${idx}.addressLine1`)}
                    />

                    <Input
                      label="Address Line 2 (Optional)"
                      placeholder="Apartment, Wing, Colony"
                      error={errors.addresses?.[idx]?.addressLine2?.message}
                      {...register(`addresses.${idx}.addressLine2`)}
                    />

                    <Input
                      label="Landmark (Optional)"
                      placeholder="Near landmark or prominent spot"
                      error={errors.addresses?.[idx]?.landmark?.message}
                      {...register(`addresses.${idx}.landmark`)}
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        label="City"
                        placeholder="e.g. Pune"
                        error={errors.addresses?.[idx]?.city?.message}
                        {...register(`addresses.${idx}.city`)}
                      />
                      <Input
                        label="State"
                        placeholder="e.g. Maharashtra"
                        error={errors.addresses?.[idx]?.state?.message}
                        {...register(`addresses.${idx}.state`)}
                      />
                      <Input
                        label="Pincode"
                        placeholder="e.g. 411001"
                        error={errors.addresses?.[idx]?.postalCode?.message}
                        {...register(`addresses.${idx}.postalCode`)}
                      />
                    </div>
                  </div>

                  {/* Precision Pinpoint Controls */}
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 bg-white/70 p-2.5 rounded-lg border border-slate-200/70">
                    <div className="flex items-center gap-2">
                      {hasPinpoint ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                            Precise Pinpoint Set
                          </span>
                          <span className="font-mono text-[11px] text-slate-600 hidden sm:inline">
                            ({Number(currentLat).toFixed(5)}, {Number(currentLng).toFixed(5)})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-amber-800 font-medium">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                            Approximate Area (No Pinpoint)
                          </span>
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            Technician navigation will search postal/city name
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {hasPinpoint && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${Number(currentLat)},${Number(currentLng)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Test Pin</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPinpointModalIndex(idx)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                          hasPinpoint
                            ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5 text-primary-600" />
                        <span>{hasPinpoint ? 'Adjust Pinpoint' : 'Pinpoint on Map'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
            3. Customer Notes &amp; Instructions
          </h4>
          <Textarea
            placeholder="Special installation requests, preferred technician visit timings, landmark instructions..."
            rows={2}
            error={errors.notes?.message}
            {...register('notes')}
          />
        </div>
      </form>

      {pinpointModalIndex !== null && (
        <AddressPinpointModal
          isOpen={true}
          onClose={() => setPinpointModalIndex(null)}
          initialLatitude={watch(`addresses.${pinpointModalIndex}.latitude`)}
          initialLongitude={watch(`addresses.${pinpointModalIndex}.longitude`)}
          addressContext={[
            watch(`addresses.${pinpointModalIndex}.addressLine1`),
            watch(`addresses.${pinpointModalIndex}.addressLine2`),
            watch(`addresses.${pinpointModalIndex}.landmark`),
            watch(`addresses.${pinpointModalIndex}.city`),
            watch(`addresses.${pinpointModalIndex}.state`),
            watch(`addresses.${pinpointModalIndex}.postalCode`),
          ]
            .filter(Boolean)
            .join(', ')}
          title={`Pinpoint Location for Address #${pinpointModalIndex + 1}`}
          onSave={(coords) => {
            setValue(`addresses.${pinpointModalIndex}.latitude`, coords.latitude, { shouldDirty: true });
            setValue(`addresses.${pinpointModalIndex}.longitude`, coords.longitude, { shouldDirty: true });
            toast.success('Address coordinates saved.');
          }}
        />
      )}
    </Modal>
  );
};
