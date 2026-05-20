import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Unauthorized() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reason = searchParams.get('reason') || 'ACCESS_DENIED';

  const getExplanation = () => {
    if (reason === 'No email from Google') {
      return 'Could not retrieve your email address from your Google Account.';
    }
    return 'Your Google email is not registered in the Meeting Management System. Please contact your administrator to whitelist your account before signing in.';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: '48px 32px',
        width: '100%',
        maxWidth: 420,
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ef4444'
          }}>
            <ShieldAlert size={32} />
          </div>
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 12,
        }}>
          Access Denied
        </h1>

        <p style={{
          fontSize: 14, color: 'var(--text-muted)',
          lineHeight: 1.6, marginBottom: 30,
        }}>
          {getExplanation()}
        </p>

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            padding: '13px 20px',
            fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Return to Sign In
        </button>
      </div>
    </div>
  );
}
