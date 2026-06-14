import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getDashboardOverview } from '../api/dashboardApi';
import { getActivities } from '../api/activityApi';
import ActionList, {
  type ActionListItem,
} from '../components/dashboard/ActionList';
import CategoryBreakdown from '../components/dashboard/CategoryBreakdown';
import DashboardCardGrid from '../components/dashboard/DashboardCardGrid';
import SectionHeader from '../components/dashboard/SectionHeader';
import StatCard from '../components/dashboard/StatCard';
import { useAuth } from '../context/AuthContext';
import type { DashboardOverview } from '../types/dashboard';
import type { ActivityLog } from '../types/activity';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, activity] = await Promise.all([
        getDashboardOverview(),
        getActivities({ limit: 10 }),
      ]);
      setDashboard(overview);
      setRecentActivities(activity.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !dashboard) {
    return <DashboardLoading />;
  }

  if (error && !dashboard) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5">
        <p className="font-medium text-red-800">Dashboard could not be loaded</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button type="button" onClick={() => void load()} className={primaryButton}>
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) return null;
  const { myWork, campaigns, plans, inventory, operations, recentActivity } = dashboard;
  const topShare = plans.topViewedShares[0];

  const todayTasks: ActionListItem[] = myWork.todayTasks.map((task, index) => ({
    id: `${task.type}-${task.referenceId}-${index}`,
    title: task.title,
    meta: [task.referenceCode, task.dueAt ? formatDate(task.dueAt) : ''].filter(Boolean).join(' · '),
    status: taskLabel(task.type),
    tone: taskTone(task.type),
    onClick: () => navigate(taskRoute(task.type)),
  }));

  const inventoryActions: ActionListItem[] = inventory.needsConfirmation.map((item) => ({
    id: item.id,
    title: `${item.inventoryCode} · ${item.title}`,
    meta: `${item.categoryGroup} · ${item.city} / ${item.area}`,
    status: item.confirmationStatus === 'stale' ? 'Stale' : 'Never confirmed',
    tone: item.confirmationStatus === 'stale' ? 'yellow' : 'red',
    onClick: () => navigate('/inventory'),
  }));

  const overdueActions: ActionListItem[] = [
    ...operations.overdueItems.map((item) => ({
      id: `overdue-${item.operationId}-${item.itemId}`,
      title: `${item.inventoryCode || item.title} · ${item.operationCode}`,
      meta: `${item.campaignTitle || 'Campaign'}${item.scheduledDate ? ` · Due ${formatDate(item.scheduledDate)}` : ''}`,
      status: 'Overdue',
      tone: 'red' as const,
      onClick: () => navigate('/operations'),
    })),
    ...operations.proofPendingItems.map((item) => ({
      id: `proof-${item.operationId}-${item.itemId}`,
      title: `${item.inventoryCode || item.title} · ${item.operationCode}`,
      meta: item.campaignTitle || 'Campaign',
      status: 'Proof pending',
      tone: 'yellow' as const,
      onClick: () => navigate('/operations'),
    })),
  ].slice(0, 10);

  const activityItems: ActionListItem[] = recentActivities.length
    ? recentActivities.map((activity) => ({
      id: activity.id,
      title: activity.message,
      meta: [activity.entityCode, formatDateTime(activity.createdAt)].filter(Boolean).join(' · '),
      status: activity.entityType,
      tone: 'default',
      onClick: activityRoute(activity.entityType)
        ? () => navigate(activityRoute(activity.entityType) as string)
        : undefined,
    }))
    : recentActivity.map((activity) => ({
      id: activity.referenceId,
      title: activity.title,
      meta: [activity.referenceCode, formatDateTime(activity.createdAt)].filter(Boolean).join(' · '),
      status: activity.referenceType,
      tone: 'default',
      onClick: activityRoute(activity.referenceType)
        ? () => navigate(activityRoute(activity.referenceType) as string)
        : undefined,
    }));

  return (
    <div className="min-w-0 space-y-7">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Welcome back, {user?.name || 'Team'}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">{formatLongDate(new Date())}</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className={secondaryButton}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {error ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Latest refresh failed: {error}
        </div>
      ) : null}

      <section>
        <SectionHeader
          title="My Work"
          subtitle="Work assigned to you or connected to your campaigns."
        />
        <DashboardCardGrid columns={6}>
          <StatCard title="My Open Campaigns" value={myWork.myOpenCampaigns} onClick={() => navigate('/campaigns')} />
          <StatCard title="Follow-ups Due Today" value={myWork.myFollowUpsDueToday} tone={myWork.myFollowUpsDueToday ? 'yellow' : 'default'} onClick={() => navigate('/campaigns')} />
          <StatCard title="Draft Plans" value={myWork.myDraftPlans} tone="blue" onClick={() => navigate('/plans')} />
          <StatCard title="Shared / Negotiating" value={myWork.mySharedPlans} tone="purple" onClick={() => navigate('/plans')} />
          <StatCard title="Pending Operations" value={myWork.myOperationsPending} tone="blue" onClick={() => navigate('/operations')} />
          <StatCard title="Proof Pending" value={myWork.myProofPending} tone={myWork.myProofPending ? 'yellow' : 'default'} onClick={() => navigate('/operations')} />
        </DashboardCardGrid>
      </section>

      <section>
        <SectionHeader
          title="Campaign Pipeline"
          subtitle={`${campaigns.totalCampaigns} campaigns · ${campaigns.highPriorityOpen} high-priority open`}
          action={<button type="button" onClick={() => navigate('/campaigns')} className={textButton}>View Campaigns</button>}
        />
        <DashboardCardGrid columns={4}>
          <StatCard title="Open Pipeline Value" value={formatCurrencyINR(campaigns.openPipelineValue)} subtitle={`${campaigns.followUpsDueToday} follow-ups due`} tone="blue" onClick={() => navigate('/campaigns')} />
          <StatCard title="Won Value" value={formatCurrencyINR(campaigns.wonValue)} tone="green" onClick={() => navigate('/campaigns')} />
          <StatCard title="New" value={campaigns.new} />
          <StatCard title="In Discussion" value={campaigns.inDiscussion} tone="blue" />
          <StatCard title="Plan Shared" value={campaigns.planShared} tone="purple" />
          <StatCard title="Negotiating" value={campaigns.negotiating} tone="yellow" />
          <StatCard title="Won" value={campaigns.won} tone="green" />
          <StatCard title="Lost" value={campaigns.lost} tone="red" subtitle={`${formatCurrencyINR(campaigns.lostValue)} lost value`} />
        </DashboardCardGrid>
      </section>

      <section>
        <SectionHeader
          title="Plans & Sharing"
          subtitle={`${plans.totalPlans} plan versions across all campaigns.`}
          action={<button type="button" onClick={() => navigate('/plans')} className={textButton}>View Plans</button>}
        />
        <DashboardCardGrid columns={4}>
          <StatCard title="Draft Plans" value={plans.draft} tone="blue" onClick={() => navigate('/plans')} />
          <StatCard title="Shared Plans" value={plans.shared} tone="purple" onClick={() => navigate('/plans')} />
          <StatCard title="Negotiating Plans" value={plans.negotiating} tone="yellow" onClick={() => navigate('/plans')} />
          <StatCard title="Awaiting Response" value={plans.plansAwaitingResponse} tone={plans.plansAwaitingResponse ? 'yellow' : 'default'} onClick={() => navigate('/plans')} />
          <StatCard title="Shared Plan Value" value={formatCurrencyINR(plans.totalSharedValue)} />
          <StatCard title="Won Plan Value" value={formatCurrencyINR(plans.totalWonPlanValue)} tone="green" />
          <StatCard title="Won Plans" value={plans.won} tone="green" />
          <StatCard
            title="Top Viewed Share"
            value={topShare ? topShare.viewCount : 0}
            subtitle={topShare ? `${topShare.campaignCode || 'Campaign'} · ${topShare.clientName || 'Client'}` : 'No share views yet'}
            tone="blue"
            onClick={() => navigate('/plans')}
          />
        </DashboardCardGrid>
      </section>

      <section>
        <SectionHeader
          title="Inventory Health"
          subtitle={`${inventory.activeInventory} active · ${inventory.bookedInventory} booked · ${inventory.holdInventory} on hold`}
          action={<button type="button" onClick={() => navigate('/inventory')} className={textButton}>View Inventory</button>}
        />
        <DashboardCardGrid columns={4}>
          <StatCard title="Total Inventory" value={inventory.totalInventory} />
          <StatCard title="Available Inventory" value={inventory.availableInventory} tone="green" onClick={() => navigate('/inventory')} />
          <StatCard title="Fresh Inventory" value={inventory.freshInventory} tone="green" />
          <StatCard title="Stale Inventory" value={inventory.staleInventory} tone={inventory.staleInventory ? 'yellow' : 'default'} onClick={() => navigate('/inventory')} />
          <StatCard title="Never Confirmed" value={inventory.neverConfirmedInventory} tone={inventory.neverConfirmedInventory ? 'red' : 'default'} onClick={() => navigate('/inventory')} />
        </DashboardCardGrid>
        <div className="mt-3">
          <CategoryBreakdown categories={inventory.byCategory} />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Operations"
          subtitle={`${operations.totalOperations} Work Orders · ${operations.creativePending} creative pending · ${operations.poPending} PO pending`}
          action={<button type="button" onClick={() => navigate('/operations')} className={textButton}>View Operations</button>}
        />
        <DashboardCardGrid columns={6}>
          <StatCard title="Pending Work Orders" value={operations.pending} />
          <StatCard title="In Progress" value={operations.inProgress} tone="blue" />
          <StatCard title="Mounted" value={operations.mounted} tone="purple" />
          <StatCard title="Proof Pending" value={operations.proofPending} tone={operations.proofPending ? 'yellow' : 'default'} onClick={() => navigate('/operations')} />
          <StatCard title="Overdue Mountings" value={operations.overdueMountings} tone={operations.overdueMountings ? 'red' : 'default'} onClick={() => navigate('/operations')} />
          <StatCard title="Completed" value={operations.completed} tone="green" />
        </DashboardCardGrid>
      </section>

      <section>
        <SectionHeader
          title="Action Lists"
          subtitle="Immediate follow-ups, confirmations, and execution work."
        />
        <div className="grid gap-5 xl:grid-cols-2">
          <ActionSection title="Today's Follow-ups" items={todayTasks} emptyMessage="No work needs attention today." />
          <ActionSection title="Inventory Needs Confirmation" items={inventoryActions} emptyMessage="All active inventory is freshly confirmed." />
          <ActionSection title="Operations Attention" items={overdueActions} emptyMessage="No overdue mounting or proof work." />
          <ActionSection title="Recent Activity" items={activityItems} emptyMessage="Recent platform activity will appear here." />
        </div>
      </section>
    </div>
  );
};

const ActionSection = ({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: ActionListItem[];
  emptyMessage: string;
}) => (
  <div>
    <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
    <ActionList items={items} emptyMessage={emptyMessage} />
  </div>
);

const DashboardLoading = () => (
  <div className="space-y-6">
    <div className="h-16 animate-pulse rounded-md bg-slate-200" />
    {[6, 4, 4].map((count, section) => (
      <div key={section}>
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="h-[108px] animate-pulse rounded-md bg-slate-200" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const formatCurrencyINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatLongDate = (value: Date) =>
  new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(value);

const taskLabel = (type: string) => {
  if (type === 'follow_up') return 'Follow-up';
  if (type === 'inventory_confirmation') return 'Confirmation';
  if (type === 'proof_pending') return 'Proof';
  return 'Mounting';
};

const taskTone = (type: string): ActionListItem['tone'] => {
  if (type === 'mounting_overdue') return 'red';
  if (type === 'proof_pending' || type === 'inventory_confirmation') return 'yellow';
  return 'blue';
};

const taskRoute = (type: string) => {
  if (type === 'follow_up') return '/campaigns';
  if (type === 'inventory_confirmation') return '/inventory';
  return '/operations';
};

const activityRoute = (referenceType: string) => {
  if (referenceType === 'Campaign') return '/campaigns';
  if (referenceType === 'Plan') return '/plans';
  if (referenceType === 'Operation') return '/operations';
  return '';
};

const primaryButton =
  'mt-4 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700';
const secondaryButton =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50';
const textButton = 'text-sm font-medium text-emerald-700 hover:text-emerald-900';

export default Dashboard;
