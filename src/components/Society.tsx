import Link from "next/link";

export default function Society() {
  const benefits = [
    {
      title: "Prime Padel Challenge",
      description: "Event olahraga eksklusif untuk member Prime Society"
    },
    {
      title: "Private Dining",
      description: "Makan malam eksklusif dengan sesama member premium"
    },
    {
      title: "Yoga Session",
      description: "Sesi yoga dan meditasi untuk keseimbangan inner beauty"
    },
    {
      title: "Prime Concert & Staycation",
      description: "Konser musik dan staycation premium di venue eksklusif"
    }
  ];

  return (
    <section id="society" className="py-20 px-5 bg-black">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-playfair text-4xl md:text-5xl font-bold text-primary text-center mb-4">
          #COMMUNITY
        </h2>
        <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-6">
          Prime Society Membership
        </h3>
        <p className="text-lg text-white/70 text-center max-w-3xl mx-auto mb-12 leading-relaxed">
          Bergabunglah dengan komunitas eksklusif Prime Society dan nikmati pengalaman premium yang tak terbatas. 
          Akses prioritas ke event-event eksklusif, discount khusus member, dan treatment package yang dirancang khusus untuk Anda.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, index) => (
            <div 
              key={index} 
              className="bg-dark/50 border border-primary/20 p-6 rounded-lg text-center hover:border-primary/50 transition-all duration-300"
            >
              <h4 className="text-lg font-bold text-primary mb-3">
                {benefit.title}
              </h4>
              <p className="text-sm text-white/60">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            href="/sign-in?redirect_url=/my-prime"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-light px-8 py-3 text-sm font-bold tracking-wide text-dark transition hover:scale-105 hover:shadow-xl hover:shadow-primary/25"
          >
            Join Membership
          </Link>
          <p className="mt-3 text-sm text-white/55">Masuk dengan nomor WhatsApp untuk bergabung dengan DRW Prime.</p>
        </div>
      </div>
    </section>
  );
}
