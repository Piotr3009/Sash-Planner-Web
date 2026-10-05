import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import { getMyProfile } from '../services/cloudSync.js';
import './LandingPage.css';

function firstName(...names) {
  const name = names.find((value) => typeof value === 'string' && value.trim());
  return name ? name.trim().split(/\s+/)[0] : '';
}

export default function LandingPage() {
  const user = useAuthStore((state) => state.session?.user);
  const userId = user?.id;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;

    // Use the same editable profile as Settings. Entry never waits for this read.
    getMyProfile().then((result) => {
      if (active) setProfile({ userId, name: result?.full_name });
    }).catch(() => {
      // A missing/offline profile still leaves the workspace link available.
    });

    return () => { active = false; };
  }, [userId]);

  const name = firstName(
    profile?.userId === userId ? profile?.name : '',
    user?.user_metadata?.first_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
  );
  const initial = Array.from(name || user?.email || '')[0]?.toLocaleUpperCase() || '•';

  return (
    <div className="pc-welcome">
      <header className="pc-welcome__top">
        <img
          className="pc-welcome__logo"
          src="/images/welcome/production-core-logo.webp"
          alt="Production Core"
          width="213"
          height="69"
        />
        <div className="pc-welcome__account">
          <span className="pc-welcome__greeting">Welcome back{name ? `, ${name}` : ''}</span>
          <span className="pc-welcome__avatar" aria-label={name || 'Your account'}>{initial}</span>
        </div>
      </header>

      <main className="pc-welcome__hero">
        <div className="pc-welcome__art">
          <img
            src="/images/welcome/sash-window-studio.webp"
            alt="White timber box sash window with Georgian glazing bars, curved sash horns and brass fittings"
            width="1672"
            height="941"
            fetchPriority="high"
            draggable="false"
          />
        </div>
        <div className="pc-welcome__shade" aria-hidden="true" />

        <div className="pc-welcome__copy">
          <p className="pc-welcome__eyebrow">Made for your workshop</p>
          <h1><span>Every detail.</span><span>Under control.</span></h1>
          <p className="pc-welcome__description">
            From the first dimension<br />{' '}to the final cutting list.
          </p>
          <Link className="pc-welcome__enter" to="/dashboard">
            <span>Enter workspace</span><span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="pc-welcome__caption">Precision in every part</p>
      </main>

      <footer className="pc-welcome__bottom">
        <p className="pc-welcome__purpose">
          <strong>Windows &amp; doors.</strong>Timber production, connected.
        </p>
        <ol className="pc-welcome__flow" aria-label="Workflow">
          <li>Design</li><li>Batches</li><li>Production packs</li><li>Cutting lists</li>
        </ol>
      </footer>
    </div>
  );
}
