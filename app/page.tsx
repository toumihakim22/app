import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import StatsStrip from "@/components/landing/StatsStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import Campaigns from "@/components/landing/Campaigns";
import Earnings from "@/components/landing/Earnings";
import Audiences from "@/components/landing/Audiences";
import Testimonials from "@/components/landing/Testimonials";
import Faq from "@/components/landing/Faq";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      {/* Lien d'évitement : premier élément focalisable. -translate-y-24 (et non -20) : l'ombre ne dépasse plus en haut de page. */}
      <a
        href="#contenu"
        className="fixed left-4 top-3 z-[60] -translate-y-24 rounded-control bg-surface-raised px-4 py-2 text-sm font-medium text-fg shadow-popover transition-transform focus:translate-y-0"
      >
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" className="scroll-mt-20">
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <Campaigns />
        <Earnings />
        <Audiences />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
