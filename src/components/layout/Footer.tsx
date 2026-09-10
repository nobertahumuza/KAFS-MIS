import { MessageCircle, Landmark, Phone, Mail, MapPin } from "lucide-react"

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#0a0e1a] border-t border-white/[0.04] mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-gold)]/20 border border-white/[0.06] flex items-center justify-center">
              <Landmark className="w-4.5 h-4.5 text-[var(--color-gold)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">KATAHO FARMERS&apos; SACCO</p>
              <p className="text-[11px] text-white/30">Savings & Credit Cooperative</p>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-1.5">
            <a href="https://wa.me/256760399849" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-white/35 hover:text-green-400 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp: +256 760 399 849
            </a>
            <a href="tel:+256760399849" className="flex items-center gap-2 text-xs text-white/35 hover:text-[var(--color-gold)] transition-colors">
              <Phone className="w-3.5 h-3.5" />
              +256 760 399 849
            </a>
            <a href="mailto:katahofarmerssacco@gmail.com" className="flex items-center gap-2 text-xs text-white/35 hover:text-[var(--color-gold)] transition-colors">
              <Mail className="w-3.5 h-3.5" />
              katahofarmerssacco@gmail.com
            </a>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-white/35">
              <MapPin className="w-3.5 h-3.5" />
              Kataho, Uganda
            </div>
            <div className="flex items-center gap-2 text-xs text-white/35">
              <Landmark className="w-3.5 h-3.5" />
              Regulated by the SACCO Societies Act
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-5 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-white/20">
            Designed by <span className="font-medium text-white/30">NobTechWorld</span> &middot; &copy; {year} KATAHO FARMERS&apos; SACCO
          </p>
          <p className="text-[11px] text-white/15">
            All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
