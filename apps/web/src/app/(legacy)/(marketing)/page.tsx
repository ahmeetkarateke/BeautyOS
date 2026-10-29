import { LandingNav } from '@/components/landing/landing-nav'
import { LandingHero } from '@/components/landing/landing-hero'
import { LandingStatBand } from '@/components/landing/landing-stat-band'
import { LandingFeatures } from '@/components/landing/landing-features'
import { LandingSectors } from '@/components/landing/landing-sectors'
import { LandingTrustBand } from '@/components/landing/landing-trust-band'
import { LandingPilot } from '@/components/landing/landing-pilot'
import { LandingPricing } from '@/components/landing/landing-pricing'
import { LandingFAQ } from '@/components/landing/landing-faq'
import { LandingFinalCTA } from '@/components/landing/landing-final-cta'
import { LandingFooter } from '@/components/landing/landing-footer'

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingStatBand />
        <LandingFeatures />
        <LandingSectors />
        <LandingTrustBand />
        <LandingPilot />
        <LandingPricing />
        <LandingFAQ />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
    </>
  )
}
