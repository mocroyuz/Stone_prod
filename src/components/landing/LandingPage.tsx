import Footer from "../Footer";
import FeaturesSection from "./FeaturesSection";
import LandingHero from "./LandingHero";
import MetricsSection from "./MetricsSection";
import NetworksSection from "./NetworksSection";
import StepsSection from "./StepsSection";
import "./landing.css";

export default function LandingPage() {
  return (
    <main className="lp-page relative z-10 w-full">
      <LandingHero />
      <NetworksSection />
      <FeaturesSection />
      <StepsSection />
      <MetricsSection />
      <Footer />
    </main>
  );
}
