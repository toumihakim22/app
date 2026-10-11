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
      <Header />
      <main>
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
