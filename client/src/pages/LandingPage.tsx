import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const FILMSTRIP_FRAMES = Array.from({ length: 80 });

function Filmstrip() {
  return (
    <div className="lp-filmstrip" aria-hidden="true">
      <div className="lp-filmstrip-inner">
        {FILMSTRIP_FRAMES.map((_, i) => (
          <div key={i} className="lp-filmstrip-frame" />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);

  // Scroll-triggered reveals
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('[data-lp-scroll]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('lp-visible');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Nav shadow on scroll
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => {
      nav.style.borderBottomColor =
        window.scrollY > 40 ? 'rgba(242,237,228,0.1)' : 'rgba(242,237,228,0.07)';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToApp = () => navigate('/login');

  return (
    <div className="lp">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="lp-nav" ref={navRef}>
        {/* Wordmark — italic "Room" picks up the active app theme accent
            (was previously the leftover "Slug.line" pre-rebrand mark). */}
        <span className="lp-nav-logo">Draft<em style={{ fontStyle: 'italic', color: '#c17f24' }}>Room</em></span>
        <ul className="lp-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#cta">Pricing</a></li>
          <li><a href="#cta">Sign In</a></li>
          <li>
            <button className="lp-btn-primary" onClick={goToApp}>
              <span>Start Writing Free</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-left">
          <p className="lp-hero-eyebrow">For writers who mean it</p>
          <h1 className="lp-hero-headline">
            <span className="lp-hero-line-1">Write</span>
            <span className="lp-hero-line-2">The Damn</span>
            <span className="lp-hero-line-3">Script.</span>
          </h1>
          <p className="lp-hero-sub">
            Professional screenwriting software that gets out of your way.
            No ribbon menus. No legacy bloat. Just you and the page.
          </p>
          <div className="lp-hero-actions">
            <button className="lp-btn-primary" onClick={goToApp}>
              <span>Start Writing Free</span>
            </button>
            <a href="#features" className="lp-btn-ghost">
              See how it works &nbsp;→
            </a>
          </div>
        </div>

        <div className="lp-hero-right">
          <div className="lp-screenplay">
            <div className="lp-sp-scene">INT. COFFEE SHOP — EARLY MORNING</div>
            <div className="lp-sp-action">
              A woman in her forties stares at a blank document.
              The cursor blinks. Has been blinking for forty minutes.
            </div>
            <div className="lp-sp-action">
              The barista slides a second espresso across the counter
              without being asked.
            </div>
            <div className="lp-sp-character">BARISTA</div>
            <div className="lp-sp-paren">(without looking up)</div>
            <div className="lp-sp-dialogue">Another one?</div>
            <div className="lp-sp-character">WRITER</div>
            <div className="lp-sp-dialogue">
              I'm on page one. I've been on page one since Tuesday.
            </div>
            <div className="lp-sp-action">
              She opens a new tab. Types{' '}
              <em style={{ color: 'rgba(242,237,228,0.5)' }}>draftroom</em>{' '}
              into the address bar. Something shifts.
            </div>
            <div className="lp-sp-character">WRITER (CONT'D)</div>
            <div className="lp-sp-paren">(quietly)</div>
            <div className="lp-sp-dialogue">
              Oh. <span className="lp-sp-cursor" />
            </div>
          </div>
        </div>
      </section>

      <Filmstrip />

      {/* ── THE PROBLEM ─────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid rgba(242,237,228,0.07)' }}>
        <div className="lp-problem">
          <div className="lp-scene-header" data-lp-scroll>
            INT. THE PROBLEM<span className="lp-scene-dash">—</span>PRESENT DAY
          </div>

          {[
            {
              n: '01',
              headline: <>Final Draft called.<br /><em>It wants its UI back.</em></>,
              body: `You shouldn't need a manual to open a file. The software that powered Hollywood's last three decades was built for fax machines and Zip drives. DraftRoom was built for the way you actually work: fast, distraction-free, and in a browser you already have open.`,
              aside: 'DraftRoom loads in under two seconds on any device. No install. No dongle. No "Checking license…"',
            },
            {
              n: '02',
              headline: <>Format that doesn't<br /><em>fight you.</em></>,
              body: `Tab to character. Enter to dialogue. The software knows what you're trying to write. Industry-standard formatting that disappears into the work — so all you're thinking about is what your character says next, not whether this is a transition or an action line.`,
              aside: 'WGA-compliant formatting, automatically. Export to PDF or FDX at any point, no reformatting required.',
            },
            {
              n: '03',
              headline: <>Your script lives<br /><em>in the cloud.</em></>,
              body: `So do your collaborators. Co-write a pilot across three time zones. Share a read-only link with your rep. Leave notes in the margins without printing anything. Every version, saved. Every cursor, visible. Room-writing, without the room.`,
              aside: 'Real-time sync. Unlimited revision history. Invite a collaborator in under ten seconds.',
            },
          ].map(({ n, headline, body, aside }) => (
            <div key={n} className="lp-diff lp-scrollfade" data-lp-scroll>
              <div>
                <span className="lp-diff-num">{n}</span>
                <h2 className="lp-diff-headline">{headline}</h2>
                <p className="lp-diff-body">{body}</p>
              </div>
              <div className="lp-diff-annotation">{aside}</div>
            </div>
          ))}
        </div>
      </section>

      <Filmstrip />

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="lp-features" id="features">
        <div className="lp-features-wrap">
          <div className="lp-scene-header" data-lp-scroll>
            EXT. FEATURES<span className="lp-scene-dash">—</span>CONTINUOUS
          </div>

          {[
            {
              label: 'Feature One',
              scene: 'INT. THE WRITERS ROOM',
              num: '01',
              title: <>Real-time<br /><span>Collaboration</span></>,
              body: `Multiple writers, one script, zero merge conflicts. Watch your co-writer's cursor move in real time. Resolve contradictions before they become arguments. The best room writing happens when everyone can see the page at once — DraftRoom makes that possible without a whiteboard.`,
              aside: { heading: 'Spec', lines: ['Sync latency under 80ms.', 'Presence indicators for', 'every active collaborator.', 'Threaded margin notes.', 'Lock scenes while drafting.'] },
            },
            {
              label: 'Feature Two',
              scene: 'INT. THE FORMAT — DAY',
              num: '02',
              title: <>Industry-Standard<br /><span>Formatting</span></>,
              body: `There is a right way to format a script. DraftRoom knows it. Every slug line, every transition, every parenthetical — spaced and sized exactly as your production coordinator expects. The format never fights you. It's simply there, the way margins are simply there.`,
              aside: { heading: 'Spec', lines: ['Courier Prime, 12pt.', 'Auto scene numbering.', 'Smart element detection.', 'One-key element cycling.'] },
            },
            {
              label: 'Feature Three',
              scene: 'EXT. THE WORLD — ANY TIME',
              num: '03',
              title: <>Export<br /><span>Anywhere</span></>,
              body: `PDF to your agent. FDX back to the showrunner who insists on Final Draft. Fountain to the open-source loyalist on your staff. Your script, in any format, in under ten seconds. No conversion artifacts. No reformatting. No excuses not to send it.`,
              aside: { heading: 'Spec', lines: ['Export: PDF, FDX, Fountain,', 'Highland 2, Celtx.', 'Import: FDX, Fountain.', 'One-click send via email.'] },
            },
          ].map(({ label, scene, num, title, body, aside }) => (
            <div key={num} className="lp-feat-row lp-scrollfade" data-lp-scroll>
              <div>
                <div className="lp-feat-label">{label}</div>
                <div className="lp-feat-scene">{scene}</div>
                <div className="lp-feat-num">{num}</div>
              </div>
              <div>
                <h3 className="lp-feat-title">{title}</h3>
                <p className="lp-feat-body">{body}</p>
              </div>
              <div className="lp-feat-aside">
                <strong>{aside.heading}</strong>
                {aside.lines.map((l, i) => <span key={i}>{l}<br /></span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PULL QUOTE ──────────────────────────────────────────────────── */}
      <section className="lp-quote">
        <div className="lp-quote-inner lp-scrollfade" data-lp-scroll>
          <div className="lp-quote-rule" />
          <blockquote className="lp-pull-quote">
            "I rewrote my pilot in DraftRoom over a weekend. Turned it in Monday.
            My showrunner asked what happened to my formatting. I said nothing.
            That's the point."
          </blockquote>
          <div className="lp-quote-attr">
            <div className="lp-quote-rule-sm" />
            <div>
              <div className="lp-quote-name">Dana Reyes</div>
              <div className="lp-quote-title">Staff Writer, Drama Series — WGA Member</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="lp-cta" id="cta">
        <div className="lp-scrollfade" data-lp-scroll>
          <span className="lp-cta-fade">FADE TO:</span>
          <h2 className="lp-cta-headline">
            Stop stalling.<br />
            Start writing.
          </h2>
          <p className="lp-cta-sub">
            Free while you're drafting. Professional when you're ready to share.
          </p>
          <button className="lp-btn-cta" onClick={goToApp}>
            <span>Start Writing Free</span>
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">DraftRoom</div>
        <ul className="lp-footer-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#cta">Pricing</a></li>
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
        </ul>
        <div>&copy; 2026 DraftRoom — Written in California.</div>
      </footer>
    </div>
  );
}
