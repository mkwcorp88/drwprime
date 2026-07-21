import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import BeforeAfterSection from "@/components/BeforeAfterSection";
import HomeTreatmentGrid from "@/components/HomeTreatmentGrid";
import TreatmentCards from "@/components/TreatmentCards";
// import Stats from "@/components/Stats";
// import Excellence from "@/components/Excellence";
// import ProblemSolution from "@/components/ProblemSolution";
import Gallery from "@/components/Gallery";
import Society from "@/components/Society";
// import Testimonials from "@/components/Testimonials";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import MobileLayout from "@/components/MobileLayout";

export default function Home() {
  return (
    <MobileLayout>
      <main className="min-h-screen bg-black text-white overflow-x-hidden">
        <Navbar />
        <Hero />
        <TreatmentCards />
        <BeforeAfterSection />
        <HomeTreatmentGrid />
        {/* <Stats /> */}
        {/* <Excellence /> */}
        {/* <ProblemSolution /> */}
        <Gallery />
        <Society />
        {/* <Testimonials /> */}
        <Contact />
        <Footer />
      </main>
    </MobileLayout>
  );
}
