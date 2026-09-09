import { MessageCircle } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-4 px-6">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Designed by NobTechWorld</span>
        <span className="hidden sm:inline">·</span>
        <span>© {new Date().getFullYear()} KATAHO FARMERS&apos; SACCO</span>
        <span className="hidden sm:inline">·</span>
        <a
          href="https://wa.me/256760399849"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-green-600 dark:hover:text-green-400 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp: +256 760 399 849
        </a>
      </div>
    </footer>
  )
}
