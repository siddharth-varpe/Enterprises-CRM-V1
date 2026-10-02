import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  Edit2,
  ShieldCheck,
  ShieldOff,
  CheckCircle2,
  Clock,
  Briefcase,
  Wrench,
  FileText,
  Users,
  Cpu,
  Layers,
  IndianRupee,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  CreditCard,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import {
  useTechnician360Query,
  useTogglePortalAccessMutation,
  type TechnicianAdmin360Profile,
  type TechnicianAdminServiceItem,
  type TechnicianAdminJobCardItem,
  type TechnicianAdminCustomerItem,
  type TechnicianAdminAssetItem,
  type TechnicianAdminPartItem,
  type TechnicianAdminPaymentItem,
  type TechnicianItem,
} from './technicians.api';
import { TechnicianModal } from './components/TechnicianModal';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { useToast } from '../../providers/ToastProvider';
import { formatINR, formatDate, formatDateTime } from '../../lib/formatters';

export const TechnicianProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'services' | 'jobCards' | 'activeWork' | 'completed' | 'customers' | 'assets' | 'parts' | 'payments'
  >('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState('ALL');

  // Authoritative 360 Query
  const { data: profile, isLoading, isError, refetch } = useTechnician360Query(id);
  const togglePortalMutation = useTogglePortalAccessMutation();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-pulse select-none">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <ErrorState
          title="Technician Profile Not Found"
          message="The requested technician record could not be loaded. Please ensure the technician exists and that your administrator account has the required permissions."
          onRetry={() => refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => navigate('/technicians')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Technicians Roster
          </Button>
        </div>
      </div>
    );
  }

  const { technician, workSummary, financialSummary } = profile;
  const isPortalActive = Boolean(technician.portalEnabled);

  const handlePortalAccessToggle = async (enable: boolean) => {
    try {
      await togglePortalMutation.mutateAsync({
        id: technician.id,
        portalEnabled: enable,
      });
      toast.success(
        enable
          ? `Technician Portal access enabled for ${technician.fullName}.`
          : `Technician Portal access disabled for ${technician.fullName}.`,
        'Portal Access Updated'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update portal access.', 'Action Failed');
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Active
          </span>
        );
      case 'ON_LEAVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            On Leave
          </span>
        );
      case 'INACTIVE':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 h-3 text-slate-500" />
            Inactive
          </span>
        );
    }
  };

  // Availability Badge Helper
  const getAvailabilityBadge = (avail: string) => {
    switch (avail) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Available for Jobs
          </span>
        );
      case 'BUSY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Briefcase className="w-3 h-3 text-sky-600" />
            Currently On A Job
          </span>
        );
      case 'ON_LEAVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            On Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            Off Duty
          </span>
        );
    }
  };

  // Filtered Services
  const filteredServices = profile.assignedServices.filter((s: TechnicianAdminServiceItem) => {
    if (serviceStatusFilter !== 'ALL' && s.status !== serviceStatusFilter) {
      return false;
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.trim().toLowerCase();
      const matchNumber = s.serviceNumber.toLowerCase().includes(q);
      const matchCustomer = s.customerName.toLowerCase().includes(q);
      const matchMachine = s.machineName.toLowerCase().includes(q);
      return matchNumber || matchCustomer || matchMachine;
    }
    return true;
  });

  // Prepare technician item for editing modal
  const editingTechData: TechnicianItem = {
    id: technician.id,
    fullName: technician.fullName,
    phone: technician.phone,
    email: technician.email,
    status: technician.status as any,
    portalEnabled: technician.portalEnabled,
    skills: technician.skills,
    address: technician.address,
    emergencyContact: technician.emergencyContact,
    userId: null,
    createdAt: technician.createdAt,
    updatedAt: technician.updatedAt,
    activeJobsCount: workSummary.currentWorkload,
    completedJobsCount: workSummary.completedCount,
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'services', label: `Assigned Services (${profile.assignedServices.length})`, icon: <Wrench className="w-4 h-4" /> },
    { id: 'jobCards', label: `Job Cards (${profile.jobCards.length})`, icon: <FileText className="w-4 h-4" /> },
    { id: 'activeWork', label: `Current Work (${profile.currentWork.length + profile.upcomingWork.length})`, icon: <Clock className="w-4 h-4" /> },
    { id: 'completed', label: `Completed (${profile.completedServices.length})`, icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'customers', label: `Customers (${profile.customersHandled.length})`, icon: <Users className="w-4 h-4" /> },
    { id: 'assets', label: `Machines / Assets (${profile.assetsHandled.length})`, icon: <Cpu className="w-4 h-4" /> },
    { id: 'parts', label: `Parts Consumed (${profile.partsUsed.length})`, icon: <Layers className="w-4 h-4" /> },
    { id: 'payments', label: `Collections (${profile.payments.length})`, icon: <Receipt className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16 select-none animate-in fade-in duration-150">
      {/* 1. Breadcrumbs & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/technicians')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Technicians
          </button>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-slate-900">
            Technician 360° Profile
          </h1>
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-medium">
            <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate('/dashboard')}>
              Home
            </span>
            <span>&gt;</span>
            <span className="hover:text-slate-900 cursor-pointer" onClick={() => navigate('/technicians')}>
              Technicians &amp; Workforce
            </span>
            <span>&gt;</span>
            <span className="text-slate-900 font-bold">{technician.fullName}</span>
          </nav>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Technician
          </Button>
          <Button
            type="button"
            variant={isPortalActive ? 'outline' : 'primary'}
            size="sm"
            onClick={() => handlePortalAccessToggle(!isPortalActive)}
            isLoading={togglePortalMutation.isPending}
            leftIcon={
              isPortalActive ? (
                <ShieldOff className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              )
            }
          >
            {isPortalActive ? 'Disable Portal Access' : 'Enable Portal Access'}
          </Button>
        </div>
      </div>

      {/* 2. Master Technician Hero Card */}
      <Card className="border-slate-200/90 shadow-2xs overflow-hidden bg-white">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Identity & Basic Info */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-black text-2xl flex items-center justify-center shrink-0 shadow-2xs">
                {technician.fullName.charAt(0)}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {technician.fullName}
                  </h2>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    ID: {technician.id.slice(0, 8)}...
                  </span>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {getStatusBadge(technician.status)}
                  {getAvailabilityBadge(technician.availability)}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      isPortalActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isPortalActive ? (
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ShieldOff className="w-3 h-3 text-slate-400" />
                    )}
                    Portal: {isPortalActive ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>

                {/* Contact and Join Date */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1 font-mono">
                  <a
                    href={`tel:${technician.phone}`}
                    className="flex items-center gap-1.5 hover:text-primary-600 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {technician.phone}
                  </a>
                  {technician.email && (
                    <a
                      href={`mailto:${technician.email}`}
                      className="flex items-center gap-1.5 hover:text-primary-600 transition-colors font-sans"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {technician.email}
                    </a>
                  )}
                  {technician.address && (
                    <div className="flex items-center gap-1.5 font-sans truncate max-w-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{technician.address}</span>
                    </div>
                  )}
                  {technician.createdAt && (
                    <div className="flex items-center gap-1.5 font-sans text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      Joined {formatDate(technician.createdAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Skills & Specialization Pills */}
            <div className="lg:max-w-md w-full bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                Assigned Skill Sets &amp; Competencies
              </span>
              <div className="flex flex-wrap gap-1.5">
                {technician.skills && technician.skills.length > 0 ? (
                  technician.skills.map((skill: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-white text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">General Technician (All standard services)</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Authoritative Performance & Work Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Active Workload */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Active Workload</span>
            <Briefcase className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{workSummary.currentWorkload}</div>
          <p className="text-[11px] text-slate-400">
            {workSummary.inProgressCount} in progress · {workSummary.upcomingCount} upcoming
          </p>
        </div>

        {/* Completed Services */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Completed Work</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{workSummary.completedCount}</div>
          <p className="text-[11px] text-slate-400">Total verified completed services</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Completion Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{workSummary.completionRate}%</div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                workSummary.completionRate >= 80
                  ? 'bg-emerald-500'
                  : workSummary.completionRate >= 50
                  ? 'bg-indigo-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, workSummary.completionRate)}%` }}
            />
          </div>
        </div>

        {/* Average Duration */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Avg Completion Time</span>
            <Clock className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {workSummary.averageCompletionTimeFormatted || 'N/A'}
          </div>
          <p className="text-[11px] text-slate-400">
            {workSummary.isAverageCompletionTimeReliable
              ? `Based on ${workSummary.sampleSize} completed jobs`
              : 'No duration data recorded'}
          </p>
        </div>

        {/* Collections */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-1 col-span-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Collected</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {formatINR(financialSummary.totalCollected)}
          </div>
          <p className="text-[11px] text-slate-400">
            Invoiced: {formatINR(financialSummary.totalInvoiced)} · Bal: {formatINR(financialSummary.pendingBalance)}
          </p>
        </div>
      </div>

      {/* 4. Tab Navigation Header */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-2xs">
        <div className="flex space-x-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Tab Content Panes */}
      <div className="space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Active & Upcoming Highlights */}
            <div className="lg:col-span-2 space-y-6">
              {/* Current Active Work Highlight */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary-600" />
                    <h3 className="text-sm font-bold text-slate-900">Current Active Jobs</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {profile.currentWork.length} active
                  </span>
                </CardHeader>
                <CardContent className="p-4">
                  {profile.currentWork.length > 0 ? (
                    <div className="space-y-3">
                      {profile.currentWork.map((job: TechnicianAdminServiceItem) => (
                        <div
                          key={job.id}
                          className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-slate-900">
                                {job.serviceNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  job.status === 'IN_PROGRESS'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {job.status}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {job.priority}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-800">
                              {job.customerName} ·{' '}
                              <span className="text-slate-600 font-normal font-mono">{job.customerPhone}</span>
                            </p>
                            <p className="text-xs text-slate-500 font-medium">
                              Machine: <span className="font-semibold text-slate-700">{job.machineName}</span> · Type:{' '}
                              {job.serviceType.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.jobCardId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/job-cards/${job.jobCardId}`)}
                              >
                                Job Card
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/services/${job.id}`)}
                            >
                              View Service
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs italic">
                      No active jobs in progress for this technician right now.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Scheduled Work */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">Upcoming Scheduled Visits</h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    {profile.upcomingWork.length} upcoming
                  </span>
                </CardHeader>
                <CardContent className="p-4">
                  {profile.upcomingWork.length > 0 ? (
                    <div className="space-y-2.5">
                      {profile.upcomingWork.slice(0, 5).map((job: TechnicianAdminServiceItem) => (
                        <div
                          key={job.id}
                          className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200/80 transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {job.serviceNumber} · {job.customerName}
                            </div>
                            <div className="text-slate-500 font-medium mt-0.5">
                              {job.machineName} · Scheduled:{' '}
                              <span className="font-mono text-slate-700">
                                {formatDateTime(job.scheduledDate)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/services/${job.id}`)}
                          >
                            Details &gt;
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                      No upcoming scheduled assignments recorded.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right 1 Col: Administrative & Contact Details */}
            <div className="space-y-6">
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Administrative Record</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-3.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                      Full Legal Name
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{technician.fullName}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                      Primary Phone
                    </span>
                    <span className="font-mono font-bold text-slate-800">{technician.phone}</span>
                  </div>

                  {technician.email && (
                    <div>
                      <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                        Email Address
                      </span>
                      <span className="text-slate-800">{technician.email}</span>
                    </div>
                  )}

                  {technician.address && (
                    <div>
                      <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                        Residential / Workshop Address
                      </span>
                      <span className="text-slate-800">{technician.address}</span>
                    </div>
                  )}

                  {technician.emergencyContact && (
                    <div>
                      <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                        Emergency Contact
                      </span>
                      <span className="font-mono font-bold text-slate-800">{technician.emergencyContact}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                      Portal Status
                    </span>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                        isPortalActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {isPortalActive ? 'Active Mobile Portal Access' : 'Portal Access Disabled'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px] uppercase font-mono font-bold">
                      System Registration
                    </span>
                    <span className="text-slate-600 font-mono">
                      {technician.createdAt ? formatDateTime(technician.createdAt) : 'Recently'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Collections & Financial Summary Card */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="py-3 px-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Collections Summary</h3>
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Invoiced on Assigned Jobs:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatINR(financialSummary.totalInvoiced)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Collected:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatINR(financialSummary.totalCollected)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Pending Customer Balance:</span>
                    <span className="font-mono font-bold text-amber-600">
                      {formatINR(financialSummary.pendingBalance)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ASSIGNED SERVICES TAB */}
        {activeTab === 'services' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  All Assigned Services ({profile.assignedServices.length})
                </h3>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search service #, customer..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary-500 w-48 sm:w-60"
                  />
                </div>
                <select
                  value={serviceStatusFilter}
                  onChange={(e) => setServiceStatusFilter(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredServices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Service #</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Machine / Asset</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Schedule</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredServices.map((s: TechnicianAdminServiceItem) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.serviceNumber}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{s.customerName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{s.customerPhone}</div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{s.machineName}</td>
                          <td className="py-3 px-4 text-slate-600">{s.serviceType.replace(/_/g, ' ')}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.priority === 'URGENT' || s.priority === 'HIGH'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {s.priority}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {formatDate(s.scheduledDate)}
                            {s.scheduledTimeSlot && (
                              <span className="text-[10px] text-slate-400 block font-sans">
                                {s.scheduledTimeSlot}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                s.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : s.status === 'IN_PROGRESS'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/services/${s.id}`)}
                            >
                              View Service
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No services matching the selected filters.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* JOB CARDS TAB */}
        {activeTab === 'jobCards' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Job Cards &amp; Work Execution History ({profile.jobCards.length})
                </h3>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {profile.jobCards.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Job Card #</th>
                        <th className="py-3 px-4">Service</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Problem Reported</th>
                        <th className="py-3 px-4">Work Performed</th>
                        <th className="py-3 px-4">Charges</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.jobCards.map((j: TechnicianAdminJobCardItem) => (
                        <tr key={j.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{j.jobCardNumber}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{j.serviceNumber || '—'}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{j.customerName}</div>
                            <div className="text-[11px] text-slate-500">{j.assetName}</div>
                          </td>
                          <td className="py-3 px-4 max-w-xs text-slate-700 truncate">
                            {j.problemReported || 'Standard checkup'}
                          </td>
                          <td className="py-3 px-4 max-w-xs text-slate-700 truncate">
                            {j.workPerformed || 'Pending execution'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {formatINR(Number(j.totalCharges || 0))}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                j.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {j.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/job-cards/${j.id}`)}
                            >
                              View Card
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No job cards recorded for this technician.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ACTIVE & UPCOMING WORK TAB */}
        {activeTab === 'activeWork' && (
          <div className="space-y-6">
            <Card className="border-slate-200/90 shadow-2xs">
              <CardHeader className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Current Jobs &amp; Scheduled Visits ({profile.currentWork.length + profile.upcomingWork.length})
                </h3>
              </CardHeader>
              <CardContent className="p-4">
                {profile.currentWork.length > 0 || profile.upcomingWork.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...profile.currentWork, ...profile.upcomingWork].map((job: TechnicianAdminServiceItem) => (
                      <div
                        key={job.id}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{job.serviceNumber}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                            {job.status}
                          </span>
                        </div>
                        <div className="font-bold text-slate-800">{job.customerName}</div>
                        <div className="text-slate-500 font-medium">
                          Machine: {job.machineName} · Scheduled:{' '}
                          <span className="font-mono text-slate-700">{formatDateTime(job.scheduledDate)}</span>
                        </div>
                        <div className="pt-2 flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/services/${job.id}`)}
                          >
                            Open Service
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No active or upcoming assignments on schedule.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* COMPLETED SERVICES TAB */}
        {activeTab === 'completed' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Completed Services History ({profile.completedServices.length})
              </h3>
            </CardHeader>
            <CardContent className="p-0">
              {profile.completedServices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Service #</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Machine</th>
                        <th className="py-3 px-4">Completed Date</th>
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Invoice Total</th>
                        <th className="py-3 px-4">Payment Status</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.completedServices.map((s: TechnicianAdminServiceItem) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.serviceNumber}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{s.customerName}</td>
                          <td className="py-3 px-4 text-slate-700">{s.machineName}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {s.completedAt ? formatDate(s.completedAt) : 'Completed'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{s.invoiceNumber || '—'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {s.invoiceTotal ? formatINR(Number(s.invoiceTotal)) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.invoiceStatus === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : s.invoiceStatus === 'PARTIALLY_PAID'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {s.invoiceStatus || 'No Invoice'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/services/${s.id}`)}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No completed service records yet for this technician.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* CUSTOMERS HANDLED TAB */}
        {activeTab === 'customers' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Customer Accounts Serviced ({profile.customersHandled.length})
              </h3>
            </CardHeader>
            <CardContent className="p-0">
              {profile.customersHandled.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Customer Name</th>
                        <th className="py-3 px-4">Phone Number</th>
                        <th className="py-3 px-4">Total Services</th>
                        <th className="py-3 px-4">Last Service Visit</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.customersHandled.map((c: TechnicianAdminCustomerItem) => (
                        <tr key={c.customerId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{c.customerName}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{c.phone}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {c.totalServices} {c.totalServices === 1 ? 'visit' : 'visits'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {c.lastServiceDate ? formatDate(c.lastServiceDate) : 'Recently'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/customers/${c.customerId}`)}
                            >
                              Customer Profile &gt;
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No customer records associated with this technician yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ASSETS / MACHINES SERVICED TAB */}
        {activeTab === 'assets' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Equipment &amp; Machines Serviced ({profile.assetsHandled.length})
              </h3>
            </CardHeader>
            <CardContent className="p-0">
              {profile.assetsHandled.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Machine / Asset Name</th>
                        <th className="py-3 px-4">Serial Number</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Total Service Visits</th>
                        <th className="py-3 px-4">Last Serviced</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.assetsHandled.map((a: TechnicianAdminAssetItem) => (
                        <tr key={a.assetId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{a.assetName}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{a.serialNumber || '—'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{a.customerName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{a.totalServices}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {a.lastServiceDate ? formatDate(a.lastServiceDate) : 'Recently'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No machines or assets serviced yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PARTS & MATERIALS CONSUMED TAB */}
        {activeTab === 'parts' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Parts &amp; Materials Used Across Job Cards ({profile.partsUsed.length})
              </h3>
            </CardHeader>
            <CardContent className="p-0">
              {profile.partsUsed.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Part / Component</th>
                        <th className="py-3 px-4">SKU</th>
                        <th className="py-3 px-4 text-center">Quantity</th>
                        <th className="py-3 px-4">Warranty Covered</th>
                        <th className="py-3 px-4">Unit Price</th>
                        <th className="py-3 px-4">Job Card #</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.partsUsed.map((p: TechnicianAdminPartItem, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{p.partName}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{p.partSku || '—'}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{p.quantity}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.isWarrantyCovered
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {p.isWarrantyCovered ? 'Covered' : 'Chargeable'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {p.price != null ? formatINR(Number(p.price)) : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-primary-600 font-bold">
                            <button
                              type="button"
                              onClick={() => navigate(`/job-cards/${p.jobCardId}`)}
                              className="hover:underline cursor-pointer"
                            >
                              {p.jobCardNumber}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {p.date ? formatDate(p.date) : 'Recently'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No parts recorded as consumed in job cards yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PAYMENTS & COLLECTIONS TAB */}
        {activeTab === 'payments' && (
          <Card className="border-slate-200/90 shadow-2xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Payments Recorded Against Assigned Jobs ({profile.payments.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative payments registered against invoices belonging to this technician's jobs.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Total Collected: {formatINR(financialSummary.totalCollected)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {profile.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/90 font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Payment #</th>
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4">Reference / UTR</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.payments.map((p: TechnicianAdminPaymentItem) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.paymentNumber}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{p.invoiceNumber}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{p.customerName}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{p.paymentMethod}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{p.referenceNumber || '—'}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {p.paymentDate ? formatDate(p.paymentDate) : 'Recently'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                            {formatINR(Number(p.amount))}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No payment collections recorded against this technician's jobs.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Technician Modal */}
      <TechnicianModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          refetch();
        }}
        technician={editingTechData}
      />
    </div>
  );
};
export default TechnicianProfilePage;
