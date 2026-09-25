import { useCallback, useRef, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useListForfaits, Forfait } from '@workspace/api-client-react';
import airtelLogoPath from '@assets/IMG_8238_1786998122601.jpeg';
import moovLogoPath from '@assets/IMG_8244_1786998122601.png';
import { Smartphone, CreditCard, Zap, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BannerSlider } from '@/components/banner-slider';

/* ── Bouton flottant glissable ───────────────────────────────────────── */
function FloatingForfaitsButton({ onScrollTo }: { onScrollTo: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [overTrash, setOverTrash] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('nfg-float-hidden') === '1') return;
    setVisible(true);
    // Positionner après le montage pour avoir les dimensions réelles
    requestAnimationFrame(() => {
      const btn = btnRef.current;
      if (!btn) return;
      const saved = localStorage.getItem('nfg-float-pos');
      let x = NaN;
      let y = NaN;
      if (saved) {
        try { ({ x, y } = JSON.parse(saved)); } catch { x = NaN; y = NaN; }
      }
      if (!saved || isNaN(x!) || isNaN(y!)) {
        x = window.innerWidth - btn.offsetWidth - 16;
        y = window.innerHeight / 2 - btn.offsetHeight / 2;
      }
      btn.style.left = x + 'px';
      btn.style.top  = y + 'px';
    });
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);

    const rect   = btn.getBoundingClientRect();
    const offX   = e.clientX - rect.left;
    const offY   = e.clientY - rect.top;
    let hasMoved = false;
    let curX = rect.left, curY = rect.top;

    setShowTrash(true);

    const TRASH_ZONE = 110; // px depuis le bas

    const onMove = (ev: PointerEvent) => {
      const nx = Math.max(0, Math.min(window.innerWidth  - btn.offsetWidth,  ev.clientX - offX));
      const ny = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, ev.clientY - offY));
      if (Math.abs(nx - curX) > 4 || Math.abs(ny - curY) > 4) hasMoved = true;
      curX = nx; curY = ny;
      btn.style.left = nx + 'px';
      btn.style.top  = ny + 'px';
      setOverTrash(ev.clientY > window.innerHeight - TRASH_ZONE);
    };

    const onUp = (ev: PointerEvent) => {
      btn.removeEventListener('pointermove', onMove);
      btn.removeEventListener('pointerup',   onUp);
      setShowTrash(false);
      setOverTrash(false);
      if (!hasMoved) { onScrollTo(); return; }
      if (ev.clientY > window.innerHeight - TRASH_ZONE) {
        setVisible(false);
        localStorage.setItem('nfg-float-hidden', '1');
      } else {
        localStorage.setItem('nfg-float-pos', JSON.stringify({ x: curX, y: curY }));
      }
    };

    btn.addEventListener('pointermove', onMove);
    btn.addEventListener('pointerup',   onUp);
  };

  if (!visible) return null;

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={handlePointerDown}
        style={{ position: 'fixed', left: 0, top: 0, touchAction: 'none', zIndex: 50 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#E4002B] text-white font-semibold shadow-lg text-sm select-none cursor-grab active:cursor-grabbing border-2 border-white/30"
        aria-label="Voir les forfaits"
      >
        📶 Forfaits
      </button>

      {showTrash && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1 pointer-events-none">
          <div className={`p-4 rounded-full border-2 border-dashed transition-all duration-150 ${overTrash ? 'bg-red-500 border-red-600 scale-125' : 'bg-red-50 border-red-400'}`}>
            <Trash2 className={`h-7 w-7 ${overTrash ? 'text-white' : 'text-red-500'}`} />
          </div>
          <span className="text-xs font-semibold text-red-600 bg-white px-2 py-0.5 rounded-full shadow">
            {overTrash ? 'Relâcher pour supprimer' : 'Glisser ici pour supprimer'}
          </span>
        </div>
      )}
    </>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Home() {
  const { data: forfaits = [], isLoading } = useListForfaits();
  const [, navigate] = useLocation();

  // Secret admin access: 7 taps on the "2. Payez" block
  const secretCount = useRef(0);
  const secretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSecretClick = useCallback(() => {
    secretCount.current += 1;
    // Reset counter if no tap for 3 seconds
    if (secretTimer.current) clearTimeout(secretTimer.current);
    secretTimer.current = setTimeout(() => { secretCount.current = 0; }, 3000);
    if (secretCount.current >= 7) {
      secretCount.current = 0;
      if (secretTimer.current) clearTimeout(secretTimer.current);
      navigate('/qashashtchad');
    }
  }, [navigate]);

  // Grouping the forfaits
  const airtelForfaits = forfaits.filter(f => f.operateur === 'airtel');
  const moovForfaits = forfaits.filter(f => f.operateur === 'moov');

  const displayAirtel = airtelForfaits.length > 0 ? airtelForfaits : [
    { id: 'a1', operateur: 'airtel', volume: '5Go', prix: 1100, validite: '7 jours', validiteJours: 7 } as Forfait,
    { id: 'a2', operateur: 'airtel', volume: '15Go', prix: 3100, validite: '30 jours', validiteJours: 30 } as Forfait,
    { id: 'airtel-go-illimites-30j', operateur: 'airtel', volume: 'Go illimités', prix: 5500, validite: '30 jours', validiteJours: 30 } as Forfait,
  ];

  const displayMoov = moovForfaits.length > 0 ? moovForfaits : [
    { id: 'm1', operateur: 'moov', volume: '6Go', prix: 1200, validite: '7 jours', validiteJours: 7 } as Forfait,
    { id: 'm2', operateur: 'moov', volume: '13Go', prix: 2600, validite: '30 jours', validiteJours: 30 } as Forfait,
    { id: 'moov-go-illimites-30j', operateur: 'moov', volume: 'Go illimités', prix: 5500, validite: '30 jours', validiteJours: 30 } as Forfait,
  ];

  const handleBuy = (forfait: Forfait) => {
    navigate(`/achat/${forfait.id}`);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-TD', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(price);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={`${BASE}/logo-good-deal-tchad.png`}
              alt="Good Deal Tchad"
              className="h-12 object-contain"
            />
          </div>
        </div>
      </header>

      {/* Banner Slider — juste après le header */}
      <section className="w-full">
        <BannerSlider />
      </section>

      {/* Hero Section */}
      <section className="pt-16 pb-12 md:pt-24 md:pb-20 px-4 text-center">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-6">
            Rechargez votre forfait internet en{' '}
            <span className="text-primary">quelques secondes</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Achetez du crédit data pour n&apos;importe quel numéro Airtel ou Moov au Tchad. Payez instantanément par Mobile Money.
          </p>
        </div>
      </section>

      {/* Bouton flottant glissable */}
      <FloatingForfaitsButton
        onScrollTo={() => document.getElementById('forfaits')?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Forfaits Grid */}
      <section id="forfaits" className="py-12 bg-white px-4 border-y">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">

            {/* Airtel Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <img src={airtelLogoPath} alt="Airtel" className="h-12 object-contain" />
                <h2 className="text-2xl font-bold uppercase tracking-wider text-[#E4002B]">Airtel Tchad</h2>
              </div>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    <div className="h-32 bg-muted animate-pulse rounded-xl"></div>
                    <div className="h-32 bg-muted animate-pulse rounded-xl"></div>
                  </div>
                ) : (
                  displayAirtel.map(forfait => (
                    <div
                      key={forfait.id}
                      className="group relative overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-lg hover:border-[#E4002B]/50"
                      data-testid={`card-forfait-${forfait.id}`}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-[#E4002B]"></div>
                      <div className="p-6 flex items-center justify-between">
                        <div>
                          <div className="text-4xl font-extrabold tracking-tighter mb-1 text-foreground">
                            {forfait.volume}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Validité {forfait.validite}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-3">
                          <div className="text-2xl font-bold text-[#E4002B]">
                            {formatPrice(forfait.prix)}
                          </div>
                          <Button
                            className="bg-[#E4002B] hover:bg-[#E4002B]/90 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all"
                            onClick={() => handleBuy(forfait)}
                            data-testid={`button-buy-${forfait.id}`}
                          >
                            Acheter
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Moov Column */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <img src={moovLogoPath} alt="Moov Africa" className="h-12 object-contain" />
                <h2 className="text-2xl font-bold uppercase tracking-wider text-[#F7941D]">Moov Africa</h2>
              </div>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="space-y-4">
                    <div className="h-32 bg-muted animate-pulse rounded-xl"></div>
                    <div className="h-32 bg-muted animate-pulse rounded-xl"></div>
                  </div>
                ) : (
                  displayMoov.map(forfait => (
                    <div
                      key={forfait.id}
                      className="group relative overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-lg hover:border-[#F7941D]/50"
                      data-testid={`card-forfait-${forfait.id}`}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-[#F7941D]"></div>
                      <div className="p-6 flex items-center justify-between">
                        <div>
                          <div className="text-4xl font-extrabold tracking-tighter mb-1 text-foreground">
                            {forfait.volume}
                          </div>
                          <div className="text-sm font-medium text-[#003DA5] uppercase tracking-wider">
                            Validité {forfait.validite}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-3">
                          <div className="text-2xl font-bold text-[#F7941D]">
                            {formatPrice(forfait.prix)}
                          </div>
                          <Button
                            className="bg-[#F7941D] hover:bg-[#F7941D]/90 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all"
                            onClick={() => handleBuy(forfait)}
                            data-testid={`button-buy-${forfait.id}`}
                          >
                            Acheter
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-16">Comment ça marche ?</h2>
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-[2px] bg-border z-0"></div>

            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-white border shadow-sm flex items-center justify-center text-primary">
                <Smartphone className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold">1. Choisissez</h3>
              <p className="text-muted-foreground">Sélectionnez le forfait adapté à vos besoins et entrez le numéro à recharger.</p>
            </div>

            {/* Secret: tap 7 times anywhere on this block to access admin */}
            <div
              className="relative z-10 flex flex-col items-center text-center space-y-4 cursor-default select-none"
              onClick={handleSecretClick}
            >
              <div className="w-24 h-24 rounded-full bg-white border shadow-sm flex items-center justify-center text-primary">
                <CreditCard className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold">2. Payez</h3>
              <p className="text-muted-foreground">Validez votre paiement en toute sécurité via Airtel Money ou Moov Money.</p>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-white border shadow-sm flex items-center justify-center text-primary">
                <Zap className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold">3. Recevez</h3>
              <p className="text-muted-foreground">Le forfait est activé instantanément sur le numéro du bénéficiaire.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white py-12 px-4">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img
              src={`${BASE}/logo-good-deal-tchad.png`}
              alt="Good Deal Tchad"
              className="h-10 object-contain"
            />
          </div>

          <div className="flex items-center gap-6 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
            <img src={airtelLogoPath} alt="Airtel" className="h-8 object-contain" />
            <img src={moovLogoPath} alt="Moov" className="h-8 object-contain" />
          </div>

          <div className="text-sm text-muted-foreground text-center space-y-1">
            <div>© {new Date().getFullYear()} Good Deal Tchad.</div>
            <div>
              Service client :{' '}
              <a href="mailto:support@good-deal-tchad.top" className="text-primary hover:underline font-medium">
                support@good-deal-tchad.top
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
