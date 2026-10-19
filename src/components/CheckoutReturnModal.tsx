import { useEffect, useState } from "react";
import { Asterisk, Pencil, Trash2 } from "lucide-react";

import { useUser } from "../contexts/UserContext";
import { navigate } from "../hooks/useHashRoute";
import { useSubscription } from "../hooks/useSubscription";
import {
  clearCheckoutParams,
  openBillingPortal,
  readCheckoutReturn,
} from "../services/stripe";

type VerifyState = "idle" | "checking" | "timeout";

export default function StifyCheckoutModal() {
  const { user } = useUser();
  const { hasActive, refresh } = useSubscription();
  
  // --- Logique Stripe ---
  const [checkoutStatus] = useState(() => readCheckoutReturn().status);
  const [open, setOpen] = useState(true); // Ouvert par défaut pour la démo
  const [verify, setVerify] = useState<VerifyState>("idle");
  const [retryKey, setRetryKey] = useState(0);

  // --- État UI (Image) ---
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const isSuccess = checkoutStatus === "success";

  const close = () => {
    clearCheckoutParams();
    setOpen(false);
  };

  /* Vérifie l'abonnement (8 essais). */
  useEffect(() => {
    if (checkoutStatus !== "success" || !user) return;

    let cancelled = false;

    const verifySubscription = async () => {
      setVerify("checking");

      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (cancelled) return;
        const current = await refresh();

        if (current?.status === "active" || current?.status === "trialing") {
          if (!cancelled) setVerify("idle");
          return;
        }

        if (attempt < 7) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      }

      if (!cancelled) setVerify("timeout");
    };

    void verifySubscription();
    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, refresh, user, retryKey]);

  /* Empêcher le scroll du body */
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleManageBilling = async () => {
    if (!user) {
      close();
      navigate("signin");
      return;
    }

    if (hasActive) {
      try {
        await openBillingPortal();
      } catch {
        close();
        navigate("settings");
      }
      return;
    }

    close();
    navigate("pricing");
  };

  if (!open) return null;

  const checking = isSuccess && !!user && !hasActive && verify !== "timeout";

  // --- Gestion des textes du bouton selon l'état Stripe ---
  let buttonText = "Submit your order";
  let onButtonClick = () => {
    // Action par défaut (ex: rediriger vers Stripe Checkout)
    // Si pas de checkoutStatus, on simule un clic sur "Submit"
    console.log("Redirect to Stripe Checkout");
  };
  let isButtonDisabled = false;

  if (checkoutStatus) {
    if (!isSuccess) {
      buttonText = "Back to plans";
      onButtonClick = () => {
        close();
        navigate("pricing");
      };
    } else if (hasActive) {
      buttonText = "Start using Stone";
      onButtonClick = () => {
        close();
        navigate("home");
      };
    } else if (!user) {
      buttonText = "Sign in to unlock";
      onButtonClick = () => {
        close();
        navigate("signin");
      };
    } else if (verify === "timeout") {
      buttonText = "Check again";
      onButtonClick = () => setRetryKey((key) => key + 1);
    } else if (checking) {
      buttonText = "Unlocking…";
      isButtonDisabled = true;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] p-4 font-sans text-neutral-900">
      
      {/* Carte Principale */}
      <div className="w-full max-w-[480px] overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        
        {/* En-tête : Logo & Avatar */}
        <header className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Asterisk className="h-6 w-6 stroke-[3]" />
            <span>STIFY</span>
          </div>
          <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200">
            <img
              src={user?.avatar || "https://i.pravatar.cc/150?img=11"}
              alt="User avatar"
              className="h-full w-full object-cover grayscale"
            />
          </div>
        </header>

        {/* Contenu */}
        <div className="px-8 py-6">
          
          {/* Titre et sous-titre */}
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              {checkoutStatus === "success" ? "Payment received" : "Your order"}
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
              {checkoutStatus === "success" 
                ? "Your payment went through. This only takes a few seconds."
                : "Hello Matt! Your order is ready, please check first whether everything meets your expectations. Thank you!"}
            </p>
          </div>

          {/* Produit */}
          <div className="mt-8 flex gap-4">
            {/* Icône du produit (Astérisque rose) */}
            <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-full bg-[#fdf2f8]">
              <Asterisk className="h-12 w-12 text-[#f9a8d4] stroke-[1.5]" />
            </div>

            {/* Détails du produit */}
            <div className="flex flex-col justify-center">
              <div>
                <button className="mb-1.5 flex items-center gap-1 rounded-[4px] bg-[#1a1a1a] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white transition-opacity hover:opacity-80">
                  Edit
                </button>
              </div>
              <h2 className="text-[15px] font-medium tracking-tight text-neutral-900">
                Upgrade to <span className="text-[#e63a8b]">Business Plus</span>
              </h2>
              <p className="mt-0.5 text-[12px] text-gray-500">
                Plan tasks, work smarter and save time.
              </p>

              {/* Boutons Quantité & Poubelle */}
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-medium text-gray-600">
                  Quantity: 1
                </span>
                <button className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Période de facturation */}
          <div className="mt-8">
            <p className="mb-2 text-[12px] font-medium text-neutral-800">Billing period</p>
            
            <div className="flex rounded-full bg-[#f4f4f5] p-1.5">
              {/* Option Mensuelle */}
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`flex flex-1 items-center justify-between rounded-full px-4 py-2.5 transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-white shadow-sm ring-1 ring-black/5"
                    : "hover:bg-gray-200/50"
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[12px] font-semibold ${billingPeriod === "monthly" ? "text-neutral-900" : "text-neutral-500"}`}>Monthly</span>
                  <span className="text-[10px] text-gray-500">7 days free</span>
                </div>
                <span className={`text-[17px] font-semibold ${billingPeriod === "monthly" ? "text-neutral-900" : "text-neutral-500"}`}>$18</span>
              </button>

              {/* Option Annuelle */}
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`flex flex-1 items-center justify-between rounded-full px-4 py-2.5 transition-all ${
                  billingPeriod === "yearly"
                    ? "bg-white shadow-sm ring-1 ring-black/5"
                    : "hover:bg-gray-200/50"
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[12px] font-semibold ${billingPeriod === "yearly" ? "text-neutral-900" : "text-neutral-500"}`}>Yearly</span>
                  <span className="text-[10px] font-medium text-[#e63a8b]">Save 20%</span>
                </div>
                <span className={`text-[17px] font-semibold ${billingPeriod === "yearly" ? "text-neutral-900" : "text-neutral-500"}`}>$175</span>
              </button>
            </div>
          </div>

          {/* Ligne de séparation */}
          <hr className="my-6 border-gray-100" />

          {/* Total */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[17px] font-semibold text-neutral-900">Total for today</span>
              <span className="text-[17px] font-semibold text-neutral-900">
                {billingPeriod === "monthly" ? "$18" : "$175"}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[12px] text-gray-500">Tax if applicable</span>
              <span className="text-[12px] text-gray-500">$1.08</span>
            </div>
          </div>

          {/* Bouton de soumission (Connecté à la logique Stripe) */}
          <button 
            onClick={onButtonClick}
            disabled={isButtonDisabled}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a1a1a] py-3.5 text-[14px] font-medium text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonText}
            {!isButtonDisabled && <Asterisk className="h-4 w-4 stroke-[2.5]" />}
          </button>
          
          {/* Bouton secondaire pour gérer la facturation si actif */}
          {hasActive && (
            <button
              onClick={() => void handleManageBilling()}
              className="mt-4 w-full text-center text-[12px] font-semibold text-gray-500 hover:text-neutral-900 transition-colors"
            >
              Manage billing
            </button>
          )}

        </div>
      </div>
    </div>
  );
}