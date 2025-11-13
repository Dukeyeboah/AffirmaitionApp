'use client';

import type { ReactNode } from 'react';

import { AppHeader } from '@/components/app-header';
import { WelcomeDialog } from '@/components/welcome-dialog';
import { DemographicsOnboardingDialog } from '@/components/demographics-onboarding-dialog';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className='pt-24'>{children}</div>
      <WelcomeDialog />
      <DemographicsOnboardingDialog />
    </>
  );
}
