import React, { useState } from "react";
import { Pencil, Trash2, Asterisk } from "lucide-react";

export default function StifyCheckout() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  return (
    // Fond gris clair pour faire ressortir la carte blanche
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] p-4 font-sans text-neutral-900">
      
      {/* Carte principale */}
      <div className="w-full max-w-[480px] overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        
        {/* En-tête : Logo & Avatar */}
        <header className="flex items-center justify-between border-b border-gray-100 px-8 py-5">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Asterisk className="h-6 w-6 stroke-[3]" />
            <span>STIFY</span>
          </div>
          <img
            src="https://i.pravatar.cc/150?img=11" // Remplacer par la vraie image de l'utilisateur
            alt="User avatar"
            className="h-8 w-8 rounded-full object-cover grayscale"
          />
        </header>

        {/* Contenu */}
        <div className="px-8 py-6">
          
          {/* Titre et sous-titre */}
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Your order</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
              Hello Matt! Your order is ready, please check first whether everything meets your expectations. Thank you!
            </p>
          </div>

          {/* Produit */}
          <div className="mt-8 flex gap-4">
            {/* Icône du produit (Astérisque rose) */}
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-pink-50/50">
              <Asterisk className="h-12 w-12 text-pink-300 stroke-[1.5]" />
            </div>

            {/* Détails du produit */}
            <div className="flex flex-col justify-center">
              <div>
                <button className="mb-1.5 flex items-center gap-1 rounded-[4px] bg-[#1a1a1a] px-1.5 py-0.5 text-[9px] font-medium text-white transition-opacity hover:opacity-80">
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
                    ? "bg-white shadow-sm"
                    : "hover:bg-gray-200/50"
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[12px] font-semibold text-neutral-900">Monthly</span>
                  <span className="text-[10px] text-gray-500">7 days free</span>
                </div>
                <span className="text-[17px] font-semibold text-neutral-900">$18</span>
              </button>

              {/* Option Annuelle */}
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`flex flex-1 items-center justify-between rounded-full px-4 py-2.5 transition-all ${
                  billingPeriod === "yearly"
                    ? "bg-white shadow-sm"
                    : "hover:bg-gray-200/50"
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className="text-[12px] font-semibold text-neutral-500">Yearly</span>
                  <span className="text-[10px] font-medium text-[#e63a8b]">Save 20%</span>
                </div>
                <span className="text-[17px] font-semibold text-neutral-500">$175</span>
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

          {/* Bouton de soumission */}
          <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a1a1a] py-3.5 text-[14px] font-medium text-white transition-colors hover:bg-black">
            Submit your order
            <Asterisk className="h-4 w-4 stroke-[2.5]" />
          </button>

        </div>
      </div>
    </div>
  );
}