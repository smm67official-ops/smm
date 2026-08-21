import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page-content">
      <div className="tm-section bg-white tm-padding-section">
        <div className="container">
          <div className="tm-empty">
            <i className="ion-alert-circled" />
            <h4>404</h4>
            <p>This page does not exist.</p>
            <Link href="/" className="tm-button">
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
