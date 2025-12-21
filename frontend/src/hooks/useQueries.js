import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

// ============================================
// Query Keys - centralized for cache management
// ============================================
export const queryKeys = {
  schemas: ['schemas'],
  networks: ['networks'],
  jobs: (params) => ['jobs', params],
  job: (id) => ['job', id],
  jobLogs: (id) => ['jobLogs', id],
  users: ['users'],
  settings: ['settings'],
  targetDBConfig: ['targetDBConfig'],
  auditLogs: (params) => ['auditLogs', params],
  agentTokens: ['agentTokens'],
  notifications: ['notifications'],
  licenseStatus: ['licenseStatus'],
  licenseMachineId: ['licenseMachineId'],
  backups: ['backups'],
};

// ============================================
// Stale Time Configuration (in milliseconds)
// ============================================
const STALE_TIME = {
  frequent: 30 * 1000,      // 30 seconds - for frequently changing data
  standard: 60 * 1000,      // 1 minute - default
  rare: 5 * 60 * 1000,      // 5 minutes - for rarely changing data
};

// ============================================
// Schema Hooks
// ============================================
export const useSchemas = () => {
  return useQuery({
    queryKey: queryKeys.schemas,
    queryFn: async () => {
      const { data } = await api.getSchemas();
      return data;
    },
    staleTime: STALE_TIME.standard,
  });
};

export const useCreateSchema = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createSchema,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schemas });
    },
  });
};

export const useUpdateSchema = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateSchema(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schemas });
    },
  });
};

export const useDeleteSchema = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSchema,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schemas });
    },
  });
};

// ============================================
// Network Hooks
// ============================================
export const useNetworks = () => {
  return useQuery({
    queryKey: queryKeys.networks,
    queryFn: async () => {
      const { data } = await api.getNetworks();
      return data;
    },
    staleTime: STALE_TIME.standard,
  });
};

export const useCreateNetwork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createNetwork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks });
    },
  });
};

export const useUpdateNetwork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateNetwork(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks });
    },
  });
};

export const useDeleteNetwork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteNetwork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks });
    },
  });
};

export const useCloneNetwork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }) => api.cloneNetwork(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks });
    },
  });
};

export const useTestNetworkConnection = () => {
  return useMutation({
    mutationFn: api.testNetworkConnection,
  });
};

export const useTestNetworkTargetConnection = () => {
  return useMutation({
    mutationFn: api.testNetworkTargetConnection,
  });
};

export const useReverseNetwork = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reverseNetwork,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networks });
    },
  });
};

// ============================================
// Job Hooks
// ============================================
export const useJobs = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.jobs(params),
    queryFn: async () => {
      const { data } = await api.getJobs(params);
      return data;
    },
    staleTime: STALE_TIME.frequent,
  });
};

export const useJob = (id) => {
  return useQuery({
    queryKey: queryKeys.job(id),
    queryFn: async () => {
      const { data } = await api.getJob(id);
      return data;
    },
    enabled: !!id,
    staleTime: STALE_TIME.frequent,
  });
};

export const useJobLogs = (id) => {
  return useQuery({
    queryKey: queryKeys.jobLogs(id),
    queryFn: async () => {
      const { data } = await api.getJobLogs(id);
      return data;
    },
    enabled: !!id,
    staleTime: STALE_TIME.frequent,
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateJob(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useDeleteJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useRunJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.runJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useToggleJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.toggleJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

// ============================================
// Notification Hooks
// ============================================
export const useNotifications = () => {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const { data } = await api.getNotifications();
      return data;
    },
    staleTime: STALE_TIME.frequent,
    refetchInterval: 30 * 1000, // Auto refetch every 30 seconds
  });
};

// ============================================
// User Hooks
// ============================================
export const useUsers = () => {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => {
      const { data } = await api.getUsers();
      return data;
    },
    staleTime: STALE_TIME.standard,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

// ============================================
// Settings Hooks
// ============================================
export const useSettings = () => {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const { data } = await api.getSettings();
      return data;
    },
    staleTime: STALE_TIME.rare,
  });
};

export const useUpdateSetting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }) => api.updateSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
};

export const useTargetDBConfig = () => {
  return useQuery({
    queryKey: queryKeys.targetDBConfig,
    queryFn: async () => {
      const { data } = await api.getTargetDBConfig();
      return data;
    },
    staleTime: STALE_TIME.rare,
  });
};

export const useUpdateTargetDBConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateTargetDBConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.targetDBConfig });
    },
  });
};

export const useTestTargetDBConnection = () => {
  return useMutation({
    mutationFn: api.testTargetDBConnection,
  });
};

// ============================================
// Audit Logs Hooks
// ============================================
export const useAuditLogs = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.auditLogs(params),
    queryFn: async () => {
      const { data } = await api.getAuditLogs(params);
      return data;
    },
    staleTime: STALE_TIME.standard,
  });
};

// ============================================
// Agent Token Hooks
// ============================================
export const useAgentTokens = () => {
  return useQuery({
    queryKey: queryKeys.agentTokens,
    queryFn: async () => {
      const { data } = await api.getAgentTokens();
      return data;
    },
    staleTime: STALE_TIME.standard,
  });
};

export const useCreateAgentToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAgentToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentTokens });
    },
  });
};

export const useRevokeAgentToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revokeAgentToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentTokens });
    },
  });
};

export const useDeleteAgentToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAgentToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agentTokens });
    },
  });
};

// ============================================
// License Hooks
// ============================================
export const useLicenseStatus = () => {
  return useQuery({
    queryKey: queryKeys.licenseStatus,
    queryFn: async () => {
      const { data } = await api.getLicenseStatus();
      return data;
    },
    staleTime: STALE_TIME.rare,
  });
};

export const useLicenseMachineId = () => {
  return useQuery({
    queryKey: queryKeys.licenseMachineId,
    queryFn: async () => {
      const { data } = await api.getLicenseMachineId();
      return data;
    },
    staleTime: STALE_TIME.rare,
  });
};

export const useActivateLicense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.activateLicense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.licenseStatus });
    },
  });
};

// ============================================
// Schema Discovery Hooks
// ============================================
export const useNetworkSchemas = (networkId) => {
  return useQuery({
    queryKey: ['networkSchemas', networkId],
    queryFn: async () => {
      const { data } = await api.listNetworkSchemas(networkId);
      return data;
    },
    enabled: !!networkId,
    staleTime: STALE_TIME.standard,
  });
};

export const useDiscoverTables = () => {
  return useMutation({
    mutationFn: ({ networkId, schema }) => api.discoverTables(networkId, schema),
  });
};

export const useBulkCreateSchemas = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.bulkCreateSchemas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schemas });
    },
  });
};

// ============================================
// Backup & Restore Hooks
// ============================================
export const useBackups = () => {
  return useQuery({
    queryKey: queryKeys.backups,
    queryFn: async () => {
      const { data } = await api.listBackups();
      return data;
    },
    staleTime: STALE_TIME.standard,
  });
};

export const useCreateBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups });
    },
  });
};

export const useRestoreBackup = () => {
  return useMutation({
    mutationFn: api.restoreBackup,
  });
};

export const useDeleteBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.backups });
    },
  });
};
