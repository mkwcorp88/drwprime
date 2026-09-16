'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMemberAuth } from '@/components/member-auth/MemberAuthProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileLayout from '@/components/MobileLayout';
import ReservationForm from '@/components/ReservationForm';
import LoadingScreen from '@/components/LoadingScreen';
import Link from 'next/link';

interface Treatment {
  id: string;
  slug: string;
  name: string;
  description: string;
  duration: number | null;
  price: number;
  benefits: string[];
  category: {
    name: string;
  };
}

export default function TreatmentDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user, isLoaded } = useMemberAuth();
  const [treatment, setTreatment] = useState<Treatment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReservationForm, setShowReservationForm] = useState(false);

  useEffect(() => {
    const fetchTreatment = async () => {
      try {
        const response = await fetch(`/api/treatments/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setTreatment(data);
        }
      } catch (error) {
        console.error('Error fetching treatment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTreatment();
  }, [slug]);

  const handleBooking = () => {
    if (!isLoaded) return;
    
    if (!user) {
      // Redirect to sign-in if not logged in
      window.location.href = '/sign-in?redirect_url=' + encodeURIComponent(window.location.pathname);
    } else {
      setShowReservationForm(true);
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <LoadingScreen />
      </MobileLayout>
    );
  }

  if (!treatment) {
    return (
      <MobileLayout>
        <Navbar />
        <main className="pt-32 min-h-screen bg-dark px-5">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Treatment Not Found</h1>
            <Link 
              href="/treatments"
              className="inline-block bg-gradient-to-r from-primary to-primary-light text-dark px-8 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
            >
              Back to Treatments
            </Link>
          </div>
        </main>
        <Footer />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <Navbar />
      
      <main className="pt-32 pb-20 min-h-screen bg-dark px-5">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-8 flex items-center gap-2 text-sm text-white/60">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span>/</span>
            <Link href="/treatments" className="hover:text-primary transition-colors">Treatments</Link>
            <span>/</span>
            <span className="text-primary">{treatment.name}</span>
          </div>

          {/* Header */}
          <div className="mb-12">
            <div className="inline-block bg-primary/10 border border-primary/30 px-4 py-2 rounded-full text-primary text-sm font-semibold mb-4">
              {treatment.category.name}
            </div>
            <h1 className="font-jakarta text-4xl md:text-5xl font-bold text-white mb-4">
              {treatment.name}
            </h1>
            <p className="text-xl text-white/70 leading-relaxed">
              {treatment.description}
            </p>
          </div>

          {/* Info Cards */}
          <div className={`grid grid-cols-1 ${treatment.duration ? 'md:grid-cols-2' : ''} gap-6 mb-12`}>
            {/* Duration Card */}
            {treatment.duration && (
              <div className="bg-black/50 border border-primary/20 p-6 rounded-xl">
                <div className="text-sm text-white/60 mb-1">Durasi Treatment</div>
                <div className="text-2xl font-bold text-primary">{treatment.duration} Menit</div>
              </div>
            )}

            {/* Price Card */}
            <div className="bg-black/50 border border-primary/20 p-6 rounded-xl">
              <div className="text-sm text-white/60 mb-1">Harga Treatment</div>
              <div className="text-2xl font-bold text-primary">Rp {treatment.price.toLocaleString('id-ID')}</div>
            </div>
          </div>

          {treatment.benefits.length > 0 && (
            <div className="bg-black/50 border border-primary/20 p-8 rounded-xl mb-12">
              <h2 className="text-2xl font-bold text-primary mb-6 font-jakarta">
                Manfaat Treatment
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {treatment.benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-white/80 leading-relaxed">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-primary/10 to-primary-light/10 border-2 border-primary/30 p-8 rounded-xl text-center">
            <h3 className="text-2xl font-bold text-white mb-4">
              Tertarik dengan Treatment Ini?
            </h3>
            <p className="text-white/70 mb-6 max-w-2xl mx-auto">
              {user ? 'Booking sekarang dan dapatkan loyalty points!' : 'Login untuk booking treatment dan dapatkan loyalty points'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleBooking}
                className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-primary-light text-dark px-8 py-4 rounded-lg font-bold text-base hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{user ? 'Booking Sekarang' : 'Login untuk Booking'}</span>
              </button>
              
              <Link 
                href="/treatments"
                className="inline-block bg-transparent border-2 border-primary/50 text-primary px-8 py-4 rounded-lg font-semibold hover:bg-primary/10 transition-all duration-300 text-center"
              >
                Lihat Treatment Lainnya
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Reservation Form Modal */}
      {showReservationForm && treatment && (
        <ReservationForm
          treatmentId={treatment.id}
          treatmentName={treatment.name}
          treatmentPrice={treatment.price}
          onClose={() => setShowReservationForm(false)}
        />
      )}

      <Footer />
    </MobileLayout>
  );
}
