import { useStore } from './store';
import { send } from '@/shared/messages';
import './Favorites.css';

export function Favorites() {
  const favorites = useStore((s) => s.favorites);
  const accounts = useStore((s) => s.accounts);

  if (favorites.length === 0) {
    return (
      <div className="favorites favorites--empty">
        No favorites yet. Pin services from the composer above.
      </div>
    );
  }

  return (
    <div className="favorites">
      <div className="favorites__title">⭐ Favorites</div>
      <div className="favorites__grid">
        {favorites.map((f) => {
          const account = accounts.find((a) => a.accountId === f.accountId);
          return (
            <button
              key={f.id}
              className="favorites__tile"
              style={{ borderLeftColor: account?.color ?? '#888' }}
              onClick={() => {
                void send({ type: 'OPEN_TARGET', favorite: f });
              }}
            >
              <div className="favorites__service">{f.label ?? f.service}</div>
              <div className="favorites__meta">
                {account?.name ?? f.accountId} · {f.region}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
