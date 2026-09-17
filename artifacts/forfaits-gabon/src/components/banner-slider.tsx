import { useState, useEffect, useCallback } from 'react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const SLIDES = [
  { src: `${BASE}/banner1.png`, alt: 'Airtel Money – Recevez vos transferts internationaux' },
];

export function BannerSlider() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('left');

  const goTo = useCallback((index: number, dir: 'left' | 'right' = 'left') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(index);
      setAnimating(false);
    }, 400);
  }, [animating]);

  // Auto-advance every 2 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % SLIDES.length;
        setDirection('left');
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full overflow-hidden relative" style={{ aspectRatio: '3.5 / 1' }}>
      {/* Slides */}
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {SLIDES.map((slide, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full">
            <img
              src={slide.src}
              alt={slide.alt}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i, i > current ? 'left' : 'right')}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? 'w-6 h-2 bg-white'
                : 'w-2 h-2 bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={() => goTo((current - 1 + SLIDES.length) % SLIDES.length, 'right')}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors z-10"
        aria-label="Précédent"
      >
        ‹
      </button>
      <button
        onClick={() => goTo((current + 1) % SLIDES.length, 'left')}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors z-10"
        aria-label="Suivant"
      >
        ›
      </button>
    </div>
  );
}
