import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import {
  useListForfaits,
  useInitierPaiement,
  useStatutPaiement,
  useConfirmerOtp,
  Forfait,
  PaiementInputPaymentOperator,
  getStatutPaiementQueryKey,
} from '@workspace/api-client-react';
import airtelLogoPath from '@assets/IMG_8238_1786998122601.jpeg';
import moovLogoPath from '@assets/IMG_8244_1786998122601.png';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Step = 'beneficiary' | 'payment_method' | 'payment_phone' | 'processing' | 'otp' | 'result';

export default function AchatPage() {
  const params = useParams<{ forfaitId: string }>();
  const [, navigate] = useLocation();

  const { data: forfaits = [], isLoading } = useListForfaits();
  const forfait: Forfait | undefined = forfaits.find(f => f.id === params.forfaitId);

  const [step, setStep] = useState<Step>('beneficiary');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaiementInputPaymentOperator | ''>('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [reference, setReference] = useState('');
  const [ussdCode, setUssdCode] = useState('');
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const initierPaiement = useInitierPaiement();
  const confirmerOtp = useConfirmerOtp();

  const { data: statusData } = useStatutPaiement(transactionId, {
    query: {
      enabled: !!transactionId && step === 'processing',
      queryKey: getStatutPaiementQueryKey(transactionId),
      refetchInterval: 3000,
    },
  });

  useEffect(() => {
    if (statusData) {
      if (statusData.statut === 'SUCCESS') setStep('result');
      else if (statusData.statut === 'FAILED') {
        setErrorMessage('Le paiement a échoué.');
        setStep('result');
      }
    }
  }, [statusData]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-TD', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(price);

  const submitPayment = () => {
    if (!forfait) return;
    setErrorMessage('');
    setStep('processing');
    initierPaiement.mutate(
      {
        data: {
          forfaitId: forfait.id,
          beneficiairePhone: beneficiaryPhone,
          paymentOperator: paymentMethod as PaiementInputPaymentOperator,
          paymentPhone,
        },
      },
      {
        onSuccess: (data) => {
          setTransactionId(data.transactionId);
          if (data.reference) setReference(data.reference);
        },
        onError: (err: any) => {
          const errorData = err?.data;
          if (errorData?.erreur === 'otp_required') {
            if (errorData.reference) setReference(errorData.reference);
            if (errorData.ussdCode) setUssdCode(errorData.ussdCode);
            setStep('otp');
          } else {
            setErrorMessage(errorData?.message || 'Une erreur est survenue.');
            setStep('result');
          }
        },
      }
    );
  };

  const submitOtp = () => {
    if (!forfait) return;
    setErrorMessage('');
    setStep('processing');
    confirmerOtp.mutate(
      {
        data: {
          reference,
          otp,
          forfaitId: forfait.id,
          beneficiairePhone: beneficiaryPhone,
          paymentOperator: paymentMethod,
          paymentPhone,
          montant: forfait.prix,
        },
      },
      {
        onSuccess: (data) => setTransactionId(data.transactionId),
        onError: (err: any) => {
          const errorData = err?.data;
          setErrorMessage(errorData?.message || 'Code incorrect ou expiré.');
          setStep('result');
        },
      }
    );
  };

  const handleBack = () => {
    if (step === 'beneficiary') navigate('/');
    else if (step === 'payment_method') setStep('beneficiary');
    else if (step === 'payment_phone') setStep('payment_method');
    else if (step === 'otp') setStep('payment_phone');
  };

  const canGoBack = step !== 'processing' && step !== 'result';

  const accentColor = forfait?.operateur === 'moov' ? '#F7941D' : '#E4002B';
  const logoSrc = forfait?.operateur === 'moov' ? moovLogoPath : airtelLogoPath;

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!forfait) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="text-muted-foreground">Forfait introuvable.</p>
        <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center gap-3">
          {canGoBack && (
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Retour"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <img src={`${BASE}/logo-good-deal-tchad.png`} alt="Good Deal Tchad" className="h-10 object-contain" />
          <div className="ml-auto text-right">
            <div className="font-bold text-sm" style={{ color: accentColor }}>{forfait.volume}</div>
            <div className="text-xs text-muted-foreground">{formatPrice(forfait.prix)}</div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-muted">
        <div
          className="h-1 transition-all duration-500"
          style={{
            backgroundColor: accentColor,
            width: step === 'beneficiary' ? '20%'
              : step === 'payment_method' ? '40%'
              : step === 'payment_phone' ? '60%'
              : step === 'processing' ? '80%'
              : step === 'otp' ? '70%'
              : '100%',
          }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pt-8 pb-12">
        <div className="w-full max-w-md space-y-6">

          {/* Forfait badge */}
          {step !== 'result' && (
            <div className="flex items-center gap-4 p-4 rounded-2xl border bg-white shadow-sm">
              <img src={logoSrc} alt={forfait.operateur} className="h-10 object-contain" />
              <div>
                <div className="font-extrabold text-xl">{forfait.volume}</div>
                <div className="text-sm text-muted-foreground">Validité {forfait.validite}</div>
              </div>
              <div className="ml-auto font-bold text-lg" style={{ color: accentColor }}>
                {formatPrice(forfait.prix)}
              </div>
            </div>
          )}

          {/* Step: Bénéficiaire */}
          {step === 'beneficiary' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">Numéro à recharger</h1>
                <p className="text-muted-foreground text-sm">Entrez le numéro {forfait.operateur === 'airtel' ? 'Airtel' : 'Moov'} du bénéficiaire.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiary">Numéro {forfait.operateur === 'airtel' ? 'Airtel' : 'Moov'}</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">+235</span>
                  <Input
                    id="beneficiary"
                    value={beneficiaryPhone}
                    onChange={(e) => setBeneficiaryPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="rounded-l-none text-lg h-12"
                    placeholder="XX XX XX XX"
                    autoFocus
                    inputMode="numeric"
                  />
                </div>
              </div>
              <Button
                className="w-full h-12 text-base rounded-xl text-white"
                style={{ backgroundColor: accentColor }}
                disabled={beneficiaryPhone.length < 8}
                onClick={() => setStep('payment_method')}
              >
                Continuer
              </Button>
            </div>
          )}

          {/* Step: Méthode de paiement */}
          {step === 'payment_method' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">Mode de paiement</h1>
                <p className="text-muted-foreground text-sm">Choisissez comment vous souhaitez payer.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMethod(PaiementInputPaymentOperator.Airtel_Money)}
                  className={`relative flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all ${paymentMethod === PaiementInputPaymentOperator.Airtel_Money ? 'border-[#E4002B] bg-[#E4002B]/5' : 'border-border bg-white hover:border-[#E4002B]/50'}`}
                >
                  {paymentMethod === PaiementInputPaymentOperator.Airtel_Money && (
                    <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-[#E4002B]" />
                  )}
                  <img src={airtelLogoPath} alt="Airtel Money" className="h-12 object-contain mb-3" />
                  <span className="font-semibold text-sm">Airtel Money</span>
                </button>
                <button
                  onClick={() => setPaymentMethod(PaiementInputPaymentOperator.Moov_Money)}
                  className={`relative flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all ${paymentMethod === PaiementInputPaymentOperator.Moov_Money ? 'border-[#F7941D] bg-[#F7941D]/5' : 'border-border bg-white hover:border-[#F7941D]/50'}`}
                >
                  {paymentMethod === PaiementInputPaymentOperator.Moov_Money && (
                    <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-[#F7941D]" />
                  )}
                  <img src={moovLogoPath} alt="Moov Money" className="h-12 object-contain mb-3" />
                  <span className="font-semibold text-sm">Moov Money</span>
                </button>
              </div>
              <Button
                className="w-full h-12 text-base rounded-xl text-white"
                style={{ backgroundColor: accentColor }}
                disabled={!paymentMethod}
                onClick={() => setStep('payment_phone')}
              >
                Continuer
              </Button>
            </div>
          )}

          {/* Step: Numéro de paiement */}
          {step === 'payment_phone' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">Numéro à débiter</h1>
                <p className="text-muted-foreground text-sm">Entrez le numéro {paymentMethod} qui sera débité.</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <img src={paymentMethod === PaiementInputPaymentOperator.Airtel_Money ? airtelLogoPath : moovLogoPath} alt="" className="h-8 object-contain" />
                <span className="font-medium text-sm">{paymentMethod}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_phone">Numéro Mobile Money</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">+235</span>
                  <Input
                    id="payment_phone"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="rounded-l-none text-lg h-12"
                    placeholder="XX XX XX XX"
                    autoFocus
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center p-4 bg-white border rounded-xl">
                <span className="text-muted-foreground text-sm">Total à payer</span>
                <span className="font-bold text-xl" style={{ color: accentColor }}>{formatPrice(forfait.prix)}</span>
              </div>
              <Button
                className="w-full h-12 text-base rounded-xl text-white"
                style={{ backgroundColor: accentColor }}
                disabled={paymentPhone.length < 8}
                onClick={submitPayment}
              >
                Obtenir mon forfait
              </Button>
            </div>
          )}

          {/* Step: Traitement */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                <Loader2 className="h-20 w-20 animate-spin relative z-10" style={{ color: accentColor }} />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Vérifiez votre téléphone</h2>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Un message USSD a été envoyé sur le <span className="font-medium">+235 {paymentPhone}</span>. Validez sur votre téléphone.
                </p>
              </div>
            </div>
          )}

          {/* Step: OTP */}
          {step === 'otp' && (
            <div className="space-y-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                <span className="font-bold text-xl" style={{ color: accentColor }}>SMS</span>
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Code de validation</h2>
                <p className="text-muted-foreground text-sm">
                  {ussdCode ? `Composez ${ussdCode} et entrez le code affiché.` : 'Entrez le code reçu par SMS.'}
                </p>
              </div>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Code OTP"
                className="text-center text-3xl tracking-widest h-16 rounded-xl"
                autoFocus
                inputMode="numeric"
              />
              <Button
                className="w-full h-12 text-base rounded-xl text-white"
                style={{ backgroundColor: accentColor }}
                disabled={otp.length < 4}
                onClick={submitOtp}
              >
                Confirmer le paiement
              </Button>
            </div>
          )}

          {/* Step: Résultat */}
          {step === 'result' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              {errorMessage ? (
                <>
                  <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center">
                    <XCircle className="h-10 w-10 text-destructive" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-destructive">Échec du paiement</h2>
                    <p className="text-sm text-muted-foreground">{errorMessage}</p>
                  </div>
                  <Button
                    className="w-full h-12 text-base rounded-xl"
                    variant="outline"
                    onClick={() => setStep('payment_method')}
                  >
                    Réessayer
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
                    Retour à l'accueil
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold text-green-700">Forfait activé !</h2>
                    <p className="text-sm text-muted-foreground">
                      Votre forfait <span className="font-medium">{forfait.volume}</span> a été activé avec succès sur le numéro <span className="font-medium">+235 {beneficiaryPhone}</span>.
                    </p>
                  </div>
                  <Button
                    className="w-full h-12 text-base rounded-xl text-white bg-green-600 hover:bg-green-700"
                    onClick={() => navigate('/')}
                  >
                    Retour à l'accueil
                  </Button>
                </>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
