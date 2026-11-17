/** BeanBase-Marke: Bohne in Kupfer auf dunkler Kachel (in beiden Themes gleich) */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[9px] bg-[#1c1714] text-[#f0a86e]" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8.5 3.8C5.2 5.8 3.6 10 4.6 14.2s4.3 6.6 7.8 6c3.6-.6 7-4.3 7-9.2S16.4 3.4 12.9 3c-1.6-.2-3.1.2-4.4.8zM9 7c2.4 1.8 3 4.3 1.8 6.5s-1.1 4.3.9 6.3" />
      </svg>
    </span>
  )
}
