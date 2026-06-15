import { tierBadge, tierToGlow } from '../lib/tcgdex'

export default function PokemonCard({ card, onClick, size = 'md' }) {
  if (!card) return null
  const badge = tierBadge(card.tier)
  const small = size === 'sm'

  return (
    <div
      className={`card-3d rounded-xl overflow-hidden cursor-pointer relative ${tierToGlow(card.tier)} bg-surface-container-low border border-white/5`}
      onClick={() => onClick?.(card)}
    >
      {/* Image */}
      <div className={`relative overflow-hidden bg-surface-bright ${small ? 'aspect-[3/4]' : 'aspect-[3/4]'}`}>
        {card.img
          ? <img src={card.img} alt={card.name} loading="lazy" className="w-full h-full object-contain p-1" />
          : <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30">catching_pokemon</span>
            </div>
        }
        {/* Tier badge */}
        <div className={`absolute top-2 right-2 text-[8px] font-bold px-2 py-0.5 rounded border uppercase ${badge}`}>
          {card.tier}
        </div>
        {/* Legendary shimmer */}
        {card.tier === 'legendary' && (
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-transparent animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 bg-surface-container-highest/90">
        <h4 className="font-body font-semibold text-xs text-on-surface truncate">{card.name}</h4>
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-mono text-[9px] text-tertiary">
            {card.types || 'Colorless'} • HP {card.hp || '—'}
          </span>
          <span className="font-mono text-[9px] text-on-surface-variant">#{card.localId}</span>
        </div>
      </div>
    </div>
  )
}
