import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { api, ApiError, loginUrl, queryClient } from './api';
import type { Me, Meta } from './types';
import { DEMO } from './utils';

export const useMeta = () => useQuery<Meta>({ queryKey: ['/api/meta'], staleTime: 60_000 });

export function useMe() {
  const query = useQuery<Me>({ queryKey: ['/api/me'], retry: false });
  const loggedOut = query.error instanceof ApiError && query.error.status === 401;
  return { ...query, me: query.data ?? null, loggedOut };
}

export function useLogin() {
  const [, navigate] = useLocation();
  return async (next = '/dashboard') => {
    if (DEMO) {
      await api('POST', '/api/auth/demo-login');
      await queryClient.invalidateQueries();
      navigate(next);
      return;
    }
    window.location.href = loginUrl(next);
  };
}

export function useLogout() {
  const [, navigate] = useLocation();
  return useMutation({
    mutationFn: () => api('POST', '/api/auth/logout'),
    onSuccess: () => {
      queryClient.clear();
      navigate('/');
    },
  });
}
