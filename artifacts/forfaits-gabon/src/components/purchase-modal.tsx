import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Clock3 } from 'lucide-react';
import { useInitierPaiement, useStatutPaiement, useConfirmerOtp, Forfait, PaiementInputPaymentOperator, getStatutPaiementQueryKey } from '@workspace/api-client-react';
import airtelLogoPath from '@assets/IMG_8238_1786998122601.jpeg';
import moovLogoPath from '@assets/IMG_8244_1786998122601.png';

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forfait: Forfait | null;
}

type Step = 'beneficiary' | 'payment_method' | 'payment_phone' | 'processing' | 'otp' | 'result';
type SimulationStatus = 'success' | 'pending' | 'failed' | 'cancelled';

export function PurchaseModal({ open, onOpenChange, forfait }: PurchaseModalProps) {
  const [step, setStep] = useState<Step>('beneficiary');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaiementInputPaymentOperator | ''>('');
  const [paymentPhone, setPaymentPhone] = useState('');
  
  const [transactionId, setTransactionId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [ussdCode, setUssdCode] = useState<string>('');
  const [otp, setOtp] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null);

  const initierPaiement = useInitierPaiement();
  const confirmerOtp = useConfirmerOtp();

  const { data: statusData } = useStatutPaiement(transactionId, {
    query: {
      enabled: !!transactionId && step === 'processing',
      queryKey: getStatutPaiementQueryKey(transactionId),
      refetchInterval: 3000,
    }
  });

  // Effect to handle status polling
  useEffect(() => {
    if (statusData) {
      const statut = statusData.statut.toLowerCase();
      if (statut === 'success') {
        setStep('result');
      } else if (statut === 'failed') {
        setErrorMessage('Le paiement a échoué.');
        setStep('result');
      }
    }
  }, [statusData]);

  // Reset state when dialog opens with a new forfait
  useEffect(() => {
    if (open) {
      setStep('beneficiary');
      setBeneficiaryPhone('');
      setPaymentMethod('');
      setPaymentPhone('');
      setTransactionId('');
      setReference('');
      setUssdCode('');
      setOtp('');
      setErrorMessage('');
      setSimulationStatus(null);
    }
  }, [open, forfait]);

  if (!forfait) return null;

  const formatPrice = (price: number) => new Intl.NumberFormat('fr-TD', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(price);

  const handleNext = () => {
    if (step === 'beneficiary' && beneficiaryPhone) setStep('payment_method');
    else if (step === 'payment_method' && paymentMethod) setStep('payment_phone');
    else if (step === 'payment_phone' && paymentPhone) submitPayment();
  };

  const submitPayment = () => {
    setErrorMessage('');
    setSimulationStatus(null);
    setStep('processing');
    
    initierPaiement.mutate({
      data: {
        forfaitId: forfait.id,
        beneficiairePhone: beneficiaryPhone,
        paymentOperator: paymentMethod as PaiementInputPaymentOperator,
        paymentPhone: paymentPhone
      }
    }, {
      onSuccess: (data) => {
        if (data.simulation) {
          const status = data.statut.toLowerCase() as SimulationStatus;
          setSimulationStatus(status);
          setErrorMessage(
            status === 'failed'
              ? 'Résultat simulé : paiement refusé. Aucun débit réel n’a eu lieu.'
              : status === 'cancelled'
                ? 'Résultat simulé : paiement annulé. Aucun débit réel n’a eu lieu.'
                : '',
          );
          setStep('result');
          return;
        }
        if (data.transactionId) setTransactionId(data.transactionId);
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
      }
    });
  };

  const submitOtp = () => {
    setErrorMessage('');
    setSimulationStatus(null);
    setStep('processing');
    
    confirmerOtp.mutate({
      data: {
        reference,
        otp,
        forfaitId: forfait.id,
        beneficiairePhone: beneficiaryPhone,
        paymentOperator: paymentMethod,
        paymentPhone: paymentPhone,
        montant: forfait.prix
      }
    }, {
      onSuccess: (data) => {
        if (data.simulation) {
          const status = data.statut.toLowerCase() as SimulationStatus;
          setSimulationStatus(status);
          setErrorMessage(
            status === 'failed'
              ? 'Résultat simulé : paiement refusé. Aucun débit réel n’a eu lieu.'
              : status === 'cancelled'
                ? 'Résultat simulé : paiement annulé. Aucun débit réel n’a eu lieu.'
                : '',
          );
          setStep('result');
          return;
        }
        if (data.transactionId) setTransactionId(data.transactionId);
      },
      onError: (err: any) => {
        const errorData = err?.data;
        setErrorMessage(errorData?.message || 'Code incorrect ou expiré.');
        setStep('result');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Prevent closing while processing
      if (step === 'processing' && !isOpen) return;
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        
        {step !== 'processing' && step !== 'result' && step !== 'beneficiary' && (
          <button 
            onClick={() => {
              if (step === 'payment_method') setStep('beneficiary');
              if (step === 'payment_phone') setStep('payment_method');
              if (step === 'otp') setStep('payment_phone');
            }}
            className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Retour</span>
          </button>
        )}

        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {step === 'result'
              ? simulationStatus === 'pending'
                ? 'Simulation en attente'
                : errorMessage
                  ? 'Échec'
                  : simulationStatus === 'success'
                    ? 'Simulation réussie'
                    : 'Succès'
              : 'Acheter le forfait'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step !== 'result' && step !== 'processing' && `${forfait.volume} • ${formatPrice(forfait.prix)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          
          {step === 'beneficiary' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg mb-6">
                <img 
                  src={forfait.operateur === 'airtel' ? airtelLogoPath : moovLogoPath} 
                  alt={forfait.operateur} 
                  className="h-10 mb-2 object-contain"
                />
                <span className="text-sm text-muted-foreground capitalize font-medium">{forfait.operateur}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="beneficiary">Numéro {forfait.operateur === 'airtel' ? 'Airtel' : 'Moov'} du bénéficiaire</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                    +235
                  </span>
                  <Input 
                    id="beneficiary"
                    value={beneficiaryPhone}
                    onChange={(e) => setBeneficiaryPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="rounded-l-none"
                    placeholder="XX XX XX XX"
                    autoFocus
                    data-testid="input-beneficiary-phone"
                  />
                </div>
              </div>
              <Button 
                className="w-full mt-4" 
                size="lg"
                disabled={beneficiaryPhone.length < 8}
                onClick={handleNext}
                data-testid="button-next-beneficiary"
              >
                Continuer
              </Button>
            </div>
          )}

          {step === 'payment_method' && (
            <div className="space-y-4">
              <h3 className="text-center text-lg font-medium mb-4">Comment souhaitez-vous payer ?</h3>
              <div className="grid grid-cols-2 gap-4">
                
                <button
                  onClick={() => setPaymentMethod(PaiementInputPaymentOperator.Airtel_Money)}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all ${paymentMethod === PaiementInputPaymentOperator.Airtel_Money ? 'border-[#E4002B] bg-[#E4002B]/5' : 'border-border hover:border-[#E4002B]/50'}`}
                  data-testid="button-pay-airtel"
                >
                  <img src={airtelLogoPath} alt="Airtel Money" className="h-12 object-contain mb-3" />
                  <span className="font-semibold text-sm">Airtel Money</span>
                  {paymentMethod === PaiementInputPaymentOperator.Airtel_Money && (
                    <CheckCircle2 className="text-[#E4002B] h-5 w-5 absolute top-2 right-2" />
                  )}
                </button>
                
                <button
                  onClick={() => setPaymentMethod(PaiementInputPaymentOperator.Moov_Money)}
                  className={`relative flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all ${paymentMethod === PaiementInputPaymentOperator.Moov_Money ? 'border-[#F7941D] bg-[#F7941D]/5' : 'border-border hover:border-[#F7941D]/50'}`}
                  data-testid="button-pay-moov"
                >
                  <img src={moovLogoPath} alt="Moov Money" className="h-12 object-contain mb-3" />
                  <span className="font-semibold text-sm">Moov Money</span>
                  {paymentMethod === PaiementInputPaymentOperator.Moov_Money && (
                    <CheckCircle2 className="text-[#F7941D] h-5 w-5 absolute top-2 right-2" />
                  )}
                </button>
                
              </div>
              <Button 
                className="w-full mt-6" 
                size="lg"
                disabled={!paymentMethod}
                onClick={handleNext}
                data-testid="button-next-payment-method"
              >
                Continuer
              </Button>
            </div>
          )}

          {step === 'payment_phone' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center">
                <img 
                  src={paymentMethod === PaiementInputPaymentOperator.Airtel_Money ? airtelLogoPath : moovLogoPath} 
                  alt={paymentMethod} 
                  className="h-12 mb-2 object-contain"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_phone">Numéro {paymentMethod} à débiter</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                    +235
                  </span>
                  <Input 
                    id="payment_phone"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="rounded-l-none"
                    placeholder="XX XX XX XX"
                    autoFocus
                    data-testid="input-payment-phone"
                    inputMode="numeric"
                    maxLength={8}
                  />
                </div>
              </div>
              
              <div className="bg-muted p-4 rounded-lg flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total à payer</span>
                <span className="font-bold text-lg">{formatPrice(forfait.prix)}</span>
              </div>

              <Button 
                className="w-full" 
                size="lg"
                disabled={paymentPhone.length !== 8}
                onClick={handleNext}
                data-testid="button-submit-payment"
              >
                Obtenir mon forfait
              </Button>
            </div>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
                <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold">Vérifiez votre téléphone</h3>
                <p className="text-sm text-muted-foreground">
                  Un message USSD a été envoyé sur votre numéro {paymentPhone}. Validez le paiement sur votre téléphone.
                </p>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-6 py-4 text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <span className="font-bold text-primary text-xl">SMS</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Validation requise</h3>
                <p className="text-sm text-muted-foreground">
                  {ussdCode === '#SANDBOX#'
                    ? 'Simulation AshTechPay : entrez le code fictif 000000. Aucun SMS ou USSD réel ne sera envoyé.'
                    : ussdCode
                      ? `Composez ${ussdCode} et entrez le code affiché ci-dessous.`
                      : 'Entrez le code reçu par SMS sur votre téléphone.'}
                </p>
              </div>
              
              <div className="space-y-2 pt-4">
                <Input 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Code OTP"
                  className="text-center text-2xl tracking-widest h-14"
                  autoFocus
                  data-testid="input-otp"
                />
              </div>

              <Button 
                className="w-full mt-4" 
                size="lg"
                disabled={otp.length < 4}
                onClick={submitOtp}
                data-testid="button-submit-otp"
              >
                Confirmer le paiement
              </Button>
            </div>
          )}

          {step === 'result' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              {simulationStatus === 'pending' ? (
                <>
                  <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-sm text-center text-muted-foreground">AshTechPay n’a créé aucune transaction pour ce scénario de test. Aucun débit réel n’a eu lieu.</p>
                  <Button className="w-full mt-4" onClick={() => onOpenChange(false)}>Fermer</Button>
                </>
              ) : errorMessage ? (
                <>
                  <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">{errorMessage}</p>
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    variant="outline"
                    onClick={() => setStep('payment_method')}
                    data-testid="button-retry-payment"
                  >
                    Réessayer
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center space-y-2">
                    {simulationStatus === 'success' ? (
                      <p className="text-sm font-medium">AshTechPay a confirmé le scénario de test. Aucun débit réel ni activation de forfait n’a eu lieu.</p>
                    ) : (
                      <p className="text-sm font-medium">
                        Votre forfait {forfait.volume} a été activé avec succès sur le numéro {beneficiaryPhone} !
                      </p>
                    )}
                  </div>
                  <Button 
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white" 
                    onClick={() => onOpenChange(false)}
                    data-testid="button-close-success"
                  >
                    Terminer
                  </Button>
                </>
              )}
            </div>
          )}
          
        </div>
      </DialogContent>
    </Dialog>
  );
}
