import Footer from "../Footer";
import FeaturesSection from "./FeaturesSection";
import LandingHero from "./LandingHero";
import NetworksSection from "./NetworksSection";
import StepsSection from "./StepsSection";
import {
  FAQSection,
  PricingOverviewSection,
  ProductShowcaseSection,
  TrustStrip,
} from "./LandingSections";
import "./landing.css";

export default function LandingPage() {
  return (
    <main className="lp-page relative z-10 w-full">
      <LandingHero />
      <TrustStrip />
      <NetworksSection />
      <FeaturesSection />
      <ProductShowcaseSection />
      <StepsSection />
      <PricingOverviewSection />
      <FAQSection />
      <Footer />
    </main>
  );
}
